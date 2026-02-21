// server/utils/aiClassifier.js

const axios = require('axios');

// Port where your Python FastAPI service runs
const PYTHON_AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001"; 

/**
 * Calls the local Python service to classify user input.
 * @param {string} rawText - The user's service request text.
 * @returns {Promise<{label: string, confidence: number}>}
 */
const classifyUserInput = async (rawText) => {
    try {
        const response = await axios.post(`${PYTHON_AI_SERVICE_URL}/classify`, {
            query: rawText,
        }, { timeout: 5000 });

        // Python service should return {label: string, confidence: number}
        return response.data; 

    } catch (error) {
        console.error("Error calling AI Classification Service:", error.message);
        // Fallback or re-throw an error to be handled by the controller
        return { 
            error: "Classification service failed. Using rule-based fallback.",
            label: null
        };
    }
};

module.exports = { classifyUserInput };