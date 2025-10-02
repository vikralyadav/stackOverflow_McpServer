# Image Text Translator Agent

This agent extracts text from an image using OCR (Optical Character Recognition) and translates the extracted text into English using Google Gemini via LangChain.

---

## Features

- 📸 Extracts text from images (supports many languages)
- 🌐 Translates any extracted text to English using Gemini
- 🤖 Fully automated: just provide an image path

---

## Setup

### 1. Prerequisites

- Node.js installed
- [Google Generative AI API key](https://ai.google.dev/)
- Place your image file in the `images` folder (or update the path in the code)

---

### 2. Install Dependencies

```sh
npm install dotenv @langchain/google-genai tesseract.js
```

---

### 3. Configure Environment

Create a `.env` file in your project root:

```
GOOGLE_API_KEY=your_google_api_key_here
```

---

## Usage

1. Update the `imagePath` variable in `language_model.js` to point to your image file.
2. Run the agent:

```sh
node language_model.js
```

---

## How It Works

- The agent uses Tesseract.js to extract text from the image.
- The extracted text is sent to Gemini with a prompt to translate it to English.
- The translated text is printed to the console.

---

## Example Output

```
📸 Extracting text from image...
📝 Extracted text: 你好，欢迎光临！
🔤 Translated text: Hello, welcome!
```

---

## License

MIT

---

## Author

Your Name
