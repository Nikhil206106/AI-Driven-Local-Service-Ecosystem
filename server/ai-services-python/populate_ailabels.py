import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# This allows the script to be run from the 'scripts' directory and still find the .env file
# by looking in the parent directory (ai-services-python).
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
else:
    # Fallback for running from the root of ai-services-python
    load_dotenv()

def populate_ai_labels():
    """
    Connects to MongoDB and populates the `aiLabel` field for any categories
    where it is missing, based on the category's `name`.
    """
    MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "services")
    LABEL_COL = "categories"

    if not MONGO_URI:
        print("Error: MONGODB_URI not found. Make sure it's in your .env file.")
        return

    client = None
    try:
        client = MongoClient(MONGO_URI)
        db = client[MONGO_DB_NAME]
        collection = db[LABEL_COL]
        print(f"Connected to MongoDB database: '{MONGO_DB_NAME}'")

        # Find categories where aiLabel is missing, null, or an empty string
        query = {"$or": [{"aiLabel": {"$exists": False}}, {"aiLabel": None}, {"aiLabel": ""}]}
        categories_to_update = list(collection.find(query))

        if not categories_to_update:
            print("All categories already have an `aiLabel`. No updates needed.")
            return

        print(f"Found {len(categories_to_update)} categories to update.")
        updated_count = 0

        for cat in categories_to_update:
            name = cat.get("name")
            if not name:
                print(f"Skipping category with _id {cat['_id']} because it has no name.")
                continue

            # Generate a simple, effective aiLabel from the name.
            # Example: "Appliance Repair" -> "Appliance Repair service"
            new_ai_label = f"{name.strip()} service"

            # Update the document
            result = collection.update_one(
                {"_id": cat["_id"]},
                {"$set": {"aiLabel": new_ai_label}}
            )

            if result.modified_count > 0:
                print(f"  - Updated '{name}' with aiLabel: '{new_ai_label}'")
                updated_count += 1

        print(f"\nFinished. Updated {updated_count} out of {len(categories_to_update)} found categories.")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        if client:
            client.close()
            print("MongoDB connection closed.")

if __name__ == "__main__":
    populate_ai_labels()