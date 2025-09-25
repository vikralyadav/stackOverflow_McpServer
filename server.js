import { config } from "dotenv";
config();

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { DynamicStructuredTool } from "langchain/tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import axios from "axios";




const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",           
  apiVersion: "v1beta",                 
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

      const response = await axios.get(
        `https://nubela.co/proxycurl/api/search/person/?keywords=${encodeURIComponent(
          keywords
        )}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PROXYCURL_API_KEY}`, 
          },
        }
      );

      const results = response.data;

      if (responseFormat === "markdown") {
        return results
          .map(
            (r, i) =>
              `${i + 1}. **${r.full_name}** — ${r.occupation || "N/A"}`
          )
          .join("\n");
      }

      return JSON.stringify(results, null, 2);
    } catch (err) {
      return `Error fetching LinkedIn data: ${err.message}`;
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
   tools: [searchTool], 
});     

const result = await executor.invoke({
  input: "Find LinkedIn profiles of AI researchers",
});

console.log("🤖 Agent response:", result.output);
