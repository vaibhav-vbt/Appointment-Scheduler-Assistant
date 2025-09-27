import express from "express";
import upload from "./middleware/multer.js";
import { extractTextFromImage } from "./utils/ocrConfig.js";
import { processSchedulingRequest } from "./utils/gemini-api.js"; // 👈 Imports the Gemini-based processor
import dotenv from "dotenv";
import fs from "fs"; // Required for optional file cleanup

dotenv.config();

const app = express();
const port = 3000;

// Middleware for parsing JSON bodies (for text-only requests)
app.use(express.json());

// Main API endpoint
app.post(
  "/schedule",
  // 1. Conditional Multer Middleware
  (req, res, next) => {
    // Check if the request is a file upload (multipart/form-data)
    const isFileUpload =
      req.headers["content-type"] &&
      req.headers["content-type"].includes("multipart/form-data");

    if (isFileUpload) {
      // Apply Multer's file upload logic
      upload.single("image")(req, res, (err) => {
        if (err) {
          return res.status(400).json({
            status: "error",
            message: `File processing error: ${err.message}`,
          });
        }
        next();
      });
    } else {
      // Skip Multer for JSON/text requests
      next();
    }
  },
  // 2. Main Logic Handler (async for OCR and Gemini calls)
  async (req, res) => {
    const textData = req.body.text;
    const fileData = req.file;
    let rawText = null;

    // --- Step 1: OCR/Text Extraction ---
    if (fileData) {
      try {
        // Get text from image via OCR API
        rawText = await extractTextFromImage(fileData.path);
      } catch (error) {
        return res
          .status(500)
          .json({ status: "error", message: error.message });
      } finally {
        // Good practice: Clean up the temporary file created by Multer
        if (fileData.path && fs.existsSync(fileData.path)) {
          console.log(fileData.path);
          fs.unlinkSync(fileData.path);
        }
      }
    } else if (textData) {
      rawText = textData;
    } else {
      return res.status(400).json({
        status: "needs_clarification",
        message: "No image or text data provided.",
      });
    }

    // Basic Guardrail: Check for sufficient extracted content
    if (!rawText || rawText.trim().length < 5) {
      return res.status(400).json({
        status: "needs_clarification",
        message: "Extracted text was too short or empty. Cannot proceed.",
      });
    }

    // --- Steps 2, 3, & 4: Process the raw text using Gemini ---
    try {
      // Gemini handles all extraction, normalization, and structuring
      const finalOutput = await processSchedulingRequest(rawText);

      // Return the final successful structured JSON (Step 4)
      return res.json(finalOutput);
    } catch (error) {
      // Return the Guardrail / Exit Condition for ambiguous inputs or API errors
      return res.status(400).json({
        status: "needs_clarification",
        message: `Ambiguous date/time or department. Gemini extraction failed: ${error.message}`,
      });
    }
  }
);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
