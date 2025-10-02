import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();

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


function readOverleafFile(fileName) {
  try {
    const filePath = path.resolve("./", fileName);
    const data = fs.readFileSync(filePath, "utf-8");
    console.log(" Resume file read successfully!");
    return data;
  } catch (error) {
    console.error(" Error reading file:", error);
    return null;
  }
}



const readResumeTool = new DynamicStructuredTool({
  name: "read_resume_file",
  description: "Reads candidate's resume from LaTeX/Overleaf file",
  schema: {
    type: "object",
    properties: {
      fileName: { type: "string", description: "Resume file name, e.g. resume.txt" },
    },
    required: ["fileName"],
  },
  func: async ({ fileName }) => readOverleafFile(fileName),
});


const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a smart assistant that helps candidates write professional job application messages.
Read the candidate's resume and the job description, then create a personalized, concise message the candidate can send to the recruiter.`,
  ],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"], // mandatory
]);


const agent = await createToolCallingAgent({
  llm: model,
  tools: [readResumeTool],
  prompt,
});

const executor = new AgentExecutor({
  agent,
  tools: [readResumeTool],
});


async function generateCandidateReply(jobDescription) {
  const result = await executor.invoke({
    input: `Please read the candidate's resume file "resume.txt" and write a professional, compelling application message for this job posting:\n\n${jobDescription}`,
  });

  console.log("\n🤖 Candidate Reply Message:\n");
  console.log(result.output);
}

generateCandidateReply(
  "We are hiring a Flutter Developer with Node.js backend experience and familiarity with BLoC or GetX for state management."
);
///