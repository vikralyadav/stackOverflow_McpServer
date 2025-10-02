import { config } from "dotenv";
config();

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import Tesseract from "tesseract.js";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiVersion: "v1beta",
  temperature: 0.7,
  apiKey: process.env.GOOGLE_API_KEY,
});


const translateToEnglish = async (text) => {
  const prompt = `Translate the following text to English:\n\n${text}`;
  const response = await model.invoke(prompt);
  console.log("🔤 Translated text:", response.content);
};

const extractTextFromImage = async (imagePath) => {
  try {
    console.log("📸 Extracting text from image...");
    const { data: { text } } = await Tesseract.recognize(imagePath, "eng"); 
    console.log("📝 Extracted text:", text.trim());
    return text.trim();
  } catch (err) {
    console.error("❌ OCR Error:", err);
  }
};


const run = async () => {
  const imagePath = "C:/Users/Bittu/Desktop/New folder (5)/mcpServer/images/chineseMenu.jpg";
  const extractedText = await extractTextFromImage(imagePath);

  if (extractedText) {
    await translateToEnglish(extractedText);
  }
};

run();
