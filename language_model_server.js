import { config } from "dotenv";
config();

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import Tesseract from "tesseract.js";


const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiVersion: "v1beta",
  temperature: 0.7,
  apiKey: process.env.GOOGLE_API_KEY,
});

const app = express();
const port = 3000;

const upload = multer({ dest: "uploads/" });


const translateToEnglish = async (text) => {
  const prompt = `Translate the following text to English:\n\n${text}`;
  const response = await model.invoke(prompt);
  return response.content;
};


const extractTextFromImage = async (imagePath) => {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, "eng"); 
    return text.trim();
  } catch (err) {
    console.error("OCR Error:", err);
    return null;
  }
};


app.post("/translate", upload.single("image"), async (req, res) => {
  try {
    let extractedText = "";

    
    if (req.body.text) {
      extractedText = req.body.text;
    }

  
    if (req.file) {
      const imagePath = path.resolve(req.file.path);
      const ocrText = await extractTextFromImage(imagePath);
      extractedText = extractedText ? extractedText + " " + ocrText : ocrText;

     
      fs.unlinkSync(imagePath);
    }

    if (!extractedText) {
      return res.status(400).json({ error: "No text or image provided" });
    }


    const translated = await translateToEnglish(extractedText);

    return res.json({
      original_text: extractedText,
      translated_text: translated,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(port, () => {
  console.log(` Server running on http://localhost:${port}`);
});
