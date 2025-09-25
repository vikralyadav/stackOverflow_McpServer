import {config} from "dotenv";
config();


const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { AgentExecutor, createToolCallingAgent } = require("langchain/agents");
const { DynamicStructuredTool } = require("langchain/tools");
const { ChatPromptTemplate } = require("@langchain/core/prompts");



const { z } = require("zod");

const model = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash", 
  temperature: 0,
  apiKey: process.env.GOOGLE_API_KEY,
});

const searchTool = new DynamicStructuredTool({
  name: "search_by_keyword",
  description: "Search LinkedIn for posts, articles, and people based on keywords",
  schema: z.object({
    keywords: z.string(),
    limit: z.number().optional(),
    responseFormat: z.enum(["json", "markdown"]).optional(),
  }),
  func: async ({ keywords, limit = 10, responseFormat = "json" }) => {
    try {
      const mockResults = [
        { title: "LinkedIn Growth Strategy", author: "John Doe" },
        { title: "Future of AI on LinkedIn", author: "Jane Smith" },
      ].slice(0, limit);

      if (responseFormat === "markdown") {
        return mockResults
          .map((r, i) => `${i + 1}. **${r.title}** — ${r.author}`)
          .join("\n");
      }

      return JSON.stringify(mockResults, null, 2);
    } catch (err) {
      return `Error: ${err.message}`;
    }
  },
});


const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful AI agent that can call tools when needed."],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"], 
]);     


const agent = createToolCallingAgent({
  llm: model,
  tools: [searchTool],
    prompt,
}); 

const executor = new AgentExecutor({
  agent,
});     

const result = await executor.invoke({
  input: "Find recent articles on LinkedIn about AI advancements",
});
console.log("🤖 Agent response:", result.output);