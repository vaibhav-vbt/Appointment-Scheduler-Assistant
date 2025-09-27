import { ocrSpace } from "ocr-space-api-wrapper";

// We don't need to define the API key here, as the library uses a default free key.
// const OCR_API_KEY = "YOUR_API_KEY_HERE";

async function extractTextFromImage(filePath) {
  try {
    // Use the library without specifying an API key to use the default one.
    const ocrResult = await ocrSpace(filePath);

    // Check for a successful result and extract the text.
    if (
      ocrResult &&
      ocrResult.ParsedResults &&
      ocrResult.ParsedResults.length > 0
    ) {
      const extractedText = ocrResult.ParsedResults[0].ParsedText;
      console.log("Successfully extracted text from image:");
      console.log(extractedText);
      return extractedText;
    } else {
      console.log("No text could be extracted from the image.");
      return null;
    }
  } catch (error) {
    console.error("Error during OCR process:", error.message);
    throw new Error("OCR process failed.");
  }
}

export { extractTextFromImage };
