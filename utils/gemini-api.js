import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize the Gemini client. It automatically picks up the API key
// from the GEMINI_API_KEY environment variable defined in your .env file.
const ai = new GoogleGenAI({});

/**
 * Defines the required structured output schema for the appointment data.
 * This instructs the Gemini model to return valid, predictable JSON.
 */
const appointmentSchema = {
  type: Type.OBJECT,
  properties: {
    department: {
      type: Type.STRING,
      description:
        "The name of the medical department (e.g., Dentistry, Cardiology). Use 'Unknown' if the department is not explicitly mentioned or clearly implied.",
    },
    date: {
      type: Type.STRING,
      description:
        "The normalized date of the appointment in YYYY-MM-DD format.",
    },
    time: {
      type: Type.STRING,
      description:
        "The normalized time of the appointment in 24-hour HH:MM format.",
    },
    tz: {
      type: Type.STRING,
      description: "The target timezone, MUST be 'Asia/Kolkata'.",
    },
  },
  // Specify required fields to ensure the model attempts to provide all data points
  required: ["department", "date", "time", "tz"],
};

/**
 * Uses the Gemini API to extract and normalize scheduling entities from raw text.
 * This combines Steps 2, 3, and 4 into a single, structured API call.
 * * @param {string} rawText The raw text (from user input or OCR).
 * @returns {Promise<object>} The final appointment object conforming to the specification.
 * @throws {Error} If the API call or JSON parsing fails, indicating ambiguity.
 */
async function processSchedulingRequest(rawText) {
  const systemInstruction = `
        You are an expert Appointment Scheduling AI. 
        Analyze the user request: "${rawText}" and extract the department, date, and time. 
        
        CRITICAL RULES:
        1. Normalize the time to 24-hour HH:MM format.
        2. Normalize the date to YYYY-MM-DD format.
        3. The default timezone for ALL conversions MUST be 'Asia/Kolkata'. Assume the current day if only time is mentioned.
        4. If required data (date/time/department) is missing or highly ambiguous, do NOT try to guess. Instead, return a JSON object with all fields set to null/empty string. The calling function will handle the clarification guardrail.
        5. The department field MUST be capitalized (e.g., "Dentistry").
    `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: rawText }] }],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: appointmentSchema,
      },
    });

    // The response text is the raw JSON string
    const jsonString = response.text.trim();
    const appointmentData = JSON.parse(jsonString);

    // Custom Guardrail: Check if the AI returned null/empty strings due to ambiguity
    if (
      !appointmentData.department ||
      !appointmentData.date ||
      !appointmentData.time
    ) {
      throw new Error(
        "Ambiguous request: Essential fields are missing after AI processing."
      );
    }

    // Combine for the final specified output format (Step 4)
    return {
      appointment: {
        department: appointmentData.department,
        date: appointmentData.date,
        time: appointmentData.time,
        tz: appointmentData.tz,
      },
      status: "ok",
    };
  } catch (error) {
    // Log the underlying error for debugging and throw a friendly error for the route handler
    console.error("Gemini Extraction Failed:", error.message);
    throw new Error(
      `Failed to extract structured data. Check if your .env is configured.`
    );
  }
}

export { processSchedulingRequest };
