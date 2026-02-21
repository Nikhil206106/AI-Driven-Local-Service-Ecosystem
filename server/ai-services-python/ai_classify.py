import os
import logging
import asyncio
import httpx
from typing import List, Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from dotenv import load_dotenv
from google import genai

# ==========================================
# Setup
# ==========================================
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

HF_TOKEN = os.getenv("HF_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "services")

if not HF_TOKEN:
    raise EnvironmentError("Missing HF_TOKEN in .env file.")

if not GEMINI_API_KEY:
    raise EnvironmentError("Missing GEMINI_API_KEY in .env file.")

# ==========================================
# Gemini Setup
# ==========================================
# Modern Client Initialization
client = genai.Client(api_key=GEMINI_API_KEY)

# ==========================================
# HuggingFace Classification Setup
# ==========================================
CLASSIFY_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"

HEADERS = {
    "Authorization": f"Bearer {HF_TOKEN}",
    "Content-Type": "application/json"
}

# ==========================================
# Database
# ==========================================
db_client = MongoClient(MONGO_URI)
db = db_client[MONGO_DB_NAME]
LABEL_COL = "categories"

# ==========================================
# FastAPI
# ==========================================
app = FastAPI(title="AI Service Matcher")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ClassificationRequest(BaseModel):
    query: str

class DescriptionRequest(BaseModel):
    service_title: str
    category_name: str

# ==========================================
# Dynamic Labels Loader
# ==========================================
async def get_dynamic_labels() -> List[Dict[str, Any]]:
    fallback = [
        {"hypothesis_text": "Plumbing repair service", "display_name": "Plumbing Services", "slug": "plumbing"},
        {"hypothesis_text": "Electrical installation or repair service", "display_name": "Electrical & Lighting", "slug": "electrical"},
        {"hypothesis_text": "Home cleaning service", "display_name": "Home Cleaning Services", "slug": "cleaning"},
        {"hypothesis_text": "Air conditioner or heating repair service", "display_name": "AC & Heating Repair", "slug": "hvac"},
        {"hypothesis_text": "Furniture repair or carpentry service", "display_name": "Carpentry & Woodwork", "slug": "carpentry"},
        {"hypothesis_text": "Wall painting or home painting service", "display_name": "Painting Services", "slug": "painting"},
    ]

    try:
        # This is a synchronous DB call. To avoid blocking the async event loop,
        # we run it in a separate thread.
        def db_call():
            return list(db[LABEL_COL].find({"isActive": {"$ne": False}}).sort("priority", -1))
        
        categories = await asyncio.to_thread(db_call)
        logging.info(f"Loaded {len(categories)} categories from DB")

        if not categories:
            logging.warning("No active categories found, using fallback.")
            return fallback

        formatted = []
        for cat in categories:
            name = cat.get("name")
            if not name:
                continue

            # Use the new `aiLabel` field for a more precise hypothesis, with a fallback.
            hypothesis = cat.get("aiLabel")
            if not hypothesis or not hypothesis.strip():
                hypothesis = f"This request is about {name.lower()} work and related repair services"

            formatted.append({
                "hypothesis_text": hypothesis,
                "display_name": name,
                "slug": cat.get("slug", name.lower().replace(" ", "-"))
            })

        return formatted if formatted else fallback

    except Exception as e:
        logging.error(f"MongoDB Error: {e}")
        return fallback

# ==========================================
# Classification (BART MNLI via HuggingFace)
# ==========================================
async def call_classification(http_client: httpx.AsyncClient, query: str, labels: List[str]):
    logging.info(f"Classifying query: '{query}'")

    payload = {
        "inputs": query,
        "parameters": {
            "candidate_labels": labels,
            "hypothesis_template": "The user needs {}."
        }
    }

    try:
        response = await http_client.post(CLASSIFY_URL, headers=HEADERS, json=payload, timeout=20.0)
        response.raise_for_status()
        result = response.json()

        if isinstance(result, dict) and "labels" in result:
            label = result["labels"][0]
            score = result["scores"][0]
            confidence = round(score * 100, 2)

            if confidence < 50:
                return {"label": "General", "confidence": confidence}

            return {"label": label, "confidence": confidence}

        return {"label": "General", "confidence": 0}

    except Exception as e:
        logging.error(f"Classification Error: {e}")
        return {"label": "General", "confidence": 0}

# ==========================================
# Classification Fallback (Gemini API)
# ==========================================
async def classify_with_gemini(query: str, labels: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Uses Gemini as a fallback for more robust classification."""
    try:
        label_names = [item['display_name'] for item in labels]
        logging.info(f"Using Gemini for classification fallback. Categories: {label_names}")

        prompt = f"""
        Analyze the following user request and classify it into ONE of the following service categories.
        Respond with ONLY the category name that is the best fit. If no category is a good fit, respond with "General Home Maintenance".

        # Categories:
        {', '.join(label_names)}

        # User Request:
        "{query}"

        # Your Answer (one category name only):
        """

        response = await client.aio.models.generate_content(
            model="gemini-flash-latest",
            contents=prompt,
        )

        if response and response.text:
            classified_label = response.text.strip()
            logging.info(f"Gemini classification result: '{classified_label}'")
            # Find the original label data based on the classified display_name
            for item in labels:
                if item['display_name'] == classified_label:
                    return {
                        "label": item['hypothesis_text'], # Return hypothesis_text to match existing flow
                        "confidence": 99.0 # Assign high confidence
                    }
            logging.warning(f"Gemini returned a label not in the provided list: '{classified_label}'")

        return {"label": "General", "confidence": 0}

    except Exception as e:
        logging.error(f"Gemini classification error: {e}")
        return {"label": "General", "confidence": 0}

# ==========================================
# Expert Advice Generator (Gemini API)
# ==========================================
async def generate_expert_advice(service_name: str, user_query: str) -> str:
    try:
        logging.info(f"Generating expert advice using Gemini for: {service_name}")

        prompt = f"""
        # ROLE
        You are a senior {service_name} expert. Speak like a friendly, helpful professional on a chat app—warm, direct, and non-robotic.

        # TASK
        Respond to: {user_query}

        # CONTENT RULES
        1. START: Acknowledge the trouble with a quick, empathetic opening (e.g., "I know how annoying a leaky tap can be!").
        2. THE CAUSE: Give ONE specific, likely reason in plain English.
        3. THE CHECK: Suggest exactly ONE "eyes-only" check that requires zero tools or risk.
        4. THE VENDOR VALUE: Briefly mention one risk of DIY (e.g., "Tinkering with this without the right sensors can actually blow the fuse").
        5. BOOKING PUSH: Recommend 1-2 specific service names (e.g., 'AC Deep Clean') and a friendly nudge to book a verified vendor today for a longterm repair.

        # STYLE
        - Keep it under 100 words.
        - Use "I" and "You." 
        - No bulleted lists or "As an AI..."
        - No step-by-step repair guides.

        """


        response = await client.aio.models.generate_content(
            model="gemini-flash-latest",
            contents=prompt,
        )

        if response and response.text:
            return response.text.strip()

        return "Please consult a certified professional for assistance."

    except Exception as e:
        logging.error(f"Gemini Error: {e}")
        return "Please consult a certified professional for assistance."

# ==========================================
# AI Service Description Generator
# ==========================================
async def generate_service_description(service_title: str, category_name: str) -> str:
    """Generates a compelling service description using Gemini."""
    try:
        logging.info(f"Generating service description for: '{service_title}'")
        prompt = f"""
        As a marketing expert, write a compelling and professional service description for a local service provider.

        Service Name: "{service_title}"
        Category: "{category_name}"

        The description should be concise (2-3 sentences), highlight the key benefits for the customer, and encourage them to book the service. It should be ready to be displayed on a service booking website.
        """
        response = await client.aio.models.generate_content(
            model="gemini-flash-latest",
            contents=prompt,
        )
        return response.text.strip() if response.text else "Could not generate a description. Please write one manually."
    except Exception as e:
        logging.error(f"Service Description Generation Error: {e}")
        return "Could not generate a description. Please write one manually."

# ==========================================
# API Endpoint
# ==========================================
@app.post("/recommend")
async def recommend_service(request: ClassificationRequest):

    label_data = await get_dynamic_labels()
    hypothesis_list = [item["hypothesis_text"] for item in label_data]

    async with httpx.AsyncClient() as http_client:
        classification_res = await call_classification(http_client, request.query, hypothesis_list)

    # Add fallback to Gemini if confidence is low or classification is "General"
    if classification_res["label"] == "General":
        logging.warning("Primary classification failed or had low confidence. Attempting fallback with Gemini.")
        classification_res = await classify_with_gemini(request.query, label_data)

    display_name = "General Home Maintenance"
    slug = "general"

    for item in label_data:
        if item["hypothesis_text"] == classification_res["label"]:
            display_name = item.get("display_name", display_name)
            slug = item.get("slug", slug)
            break

    expert_advice = await generate_expert_advice(display_name, request.query)

    return {
        "recommended_service": display_name,
        "slug": slug,
        "confidence": classification_res["confidence"],
        "expert_advice": expert_advice,
        "status": "matching_vendors"
    }

@app.post("/generate-description")
async def generate_description_endpoint(request: DescriptionRequest):
    description = await generate_service_description(request.service_title, request.category_name)
    return {"description": description}

@app.get("/health")
def health():
    return {"status": "online"}

# ==========================================
# Run
# ==========================================
if __name__ == "__main__":
    import uvicorn
    logging.info("Starting AI Service Matcher API")
    uvicorn.run("ai_classify:app", host="0.0.0.0", port=8001, reload=True)
