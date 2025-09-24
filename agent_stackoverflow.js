import { config } from "dotenv";
config();

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { DynamicStructuredTool } from "langchain/tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { z } from "zod";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash", 
  temperature: 0,
  apiKey: process.env.GOOGLE_API_KEY,
});

const searchByErrorTool = new DynamicStructuredTool({
  name: "search_by_error",
  description: "Search Stack Overflow for error-related questions",
  schema: z.object({
    errorMessage: z.string(),
    language: z.string().optional(),
    technologies: z.array(z.string()).optional(),
    minScore: z.number().optional(),
    includeComments: z.boolean().optional(),
    responseFormat: z.enum(["json", "markdown"]).optional(),
    limit: z.number().optional(),
  }),

  func: async (input) => {
    const res = await fetch("http://localhost:3000/mcp/search_by_error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return await res.text();
  },
});



const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful AI agent that can call tools when needed."],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"], 
]);







const agent = createToolCallingAgent({
  llm: model,
  tools: [searchByErrorTool],
    prompt,
});


const executor = new AgentExecutor({
  agent,
  tools: [searchByErrorTool],
});

const runAgent = async () => {
  const result = await executor.invoke({
    input: "I am getting 'TypeError: cannot read property of undefined' in JavaScript",
  });
  console.log("🤖 Agent response:", result.output);
};

runAgent();
