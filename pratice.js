import { config } from "dotenv";
config();   


import fs from "fs";
import path from "path";    

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { DynamicStructuredTool } from "langchain/tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";   



const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",  
    apiVersion: "v1beta",
    temperature: 0.7,
    apiKey: process.env.GOOGLE_API_KEY, 
});


function readFile(fileName) {
    try {
        const filePath = path.resolve("./", fileName);      
        const data = fs.readFileSync(filePath, "utf-8");
        console.log(" File read successfully!");
        return data;
    } catch (error) {
        console.error(" Error reading file:", error);
        return null;
    }       


}



const tool = new DynamicStructuredTool({
    name: "read_file",
    

});