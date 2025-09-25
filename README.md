# StackOverflow MCP Server

This project implements a Model Context Protocol (MCP) server that allows searching Stack Overflow for questions, answers, and comments using custom tools. It exposes three main tools: `search_by_error`, `search_by_tags`, and `analyze_stack_trace`.

## Features

- Search Stack Overflow by error message, tags, or stack trace.
- Fetch answers and comments for questions and answers.
- Supports JSON and Markdown response formats.
- Implements rate limiting to avoid Stack Overflow API bans.

---

## Getting Started

### 1. Install Dependencies

Install the required packages:

```sh
npm install
```

---

### 2. Start the Server

To start the server, run:

```sh
npm start
```

This will execute:

```json
"start": "node stackOverflow.js"
```

---

## How It Works

### 1. Server Initialization

The server is created using the MCP SDK:

```js
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

class StackOverflowServer {
  constructor() {
    this.server = new Server(
      { name: "stackoverflow-mcp", version: "0.1.0" },
      { capabilities: { tools: {} } }
    );
    // ...
  }
}
```

---

### 2. Tool Registration

Three tools are registered for searching Stack Overflow:

```js
this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_by_error",
      description: "Search Stack Overflow for error-related questions",
      // ...
    },
    {
      name: "search_by_tags",
      description: "Search Stack Overflow questions by tags",
      // ...
    },
    {
      name: "analyze_stack_trace",
      description: "Analyze stack trace and find relevant solutions",
      // ...
    },
  ],
}));
```

---

### 3. Handling Requests

The server handles tool requests and dispatches them to the appropriate handler:

```js
this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case "search_by_error":
      return this.handleSearchByError(args);
    case "search_by_tags":
      return this.handleSearchByTags(args);
    case "analyze_stack_trace":
      return this.handleAnalyzeStackTrace(args);
    // ...
  }
});
```

---

### 4. Searching Stack Overflow

The core search logic uses the Stack Exchange API:

```js
async searchStackOverflow(query, tags, options = {}) {
  const params = new URLSearchParams({
    site: "stackoverflow",
    sort: "votes",
    order: "desc",
    filter: DEFAULT_FILTER,
    q: query,
    ...(tags && { tagged: tags.join(";") }),
    ...(options.limit && { pagesize: String(options.limit) }),
  });
  const response = await fetch(`${STACKOVERFLOW_API}/search/advanced?${params}`);
  // ...
}
```

---

### 5. Fetching Answers and Comments

Answers and comments are fetched for each question:

```js
async fetchAnswers(questionId) {
  const response = await fetch(`${STACKOVERFLOW_API}/questions/${questionId}/answers?...`);
  // ...
}

async fetchComments(postId) {
  const response = await fetch(`${STACKOVERFLOW_API}/posts/${postId}/comments?...`);
  // ...
}
```

---

### 6. Formatting the Response

Results can be formatted as JSON or Markdown:

```js
formatResponse(results, format = "json") {
  if (format === "json") {
    return JSON.stringify(results, null, 2);
  }
  // Markdown formatting...
}
```

---

### 7. Rate Limiting

To avoid hitting API limits, requests are rate-limited:

```js
checkRateLimit() {
  // Only allow MAX_REQUESTS_PER_WINDOW per RATE_LIMIT_WINDOW_MS
}
```

---

## Example Usage

**Search by error:**

```json
{
  "name": "search_by_error",
  "arguments": {
    "errorMessage": "TypeError: Cannot read property",
    "language": "javascript",
    "limit": 2,
    "responseFormat": "markdown"
  }
}





```

---






# StackOverflow MCP Agent

This project is an AI-powered agent that leverages Google Gemini (via LangChain) and your Stack Overflow MCP Server to automatically search for solutions to programming errors. The agent can interpret natural language queries, call the Stack Overflow search tool, and return relevant answers—all in one seamless workflow.

---

## How It Works

- Uses [LangChain](https://js.langchain.com/) to orchestrate tool calls and prompt handling.
- Integrates with Google Gemini (`gemini-1.5-flash`) for advanced language understanding.
- Calls your local Stack Overflow MCP Server’s `search_by_error` tool to fetch relevant Stack Overflow results.

---

## Setup

### 1. Prerequisites

- Node.js installed
- Your Stack Overflow MCP Server running (see previous README)
- A [Google Generative AI API key](https://ai.google.dev/)

---

### 2. Install Dependencies

```sh
npm install
```

---

### 3. Configure Environment

Create a `.env` file in your project root:

```
GOOGLE_API_KEY=your_google_api_key_here
```

---

### 4. Run the Agent

```sh
node agent_stackoverflow.js
```

---

## Example

When you run the agent, it will send a query like:

```
I am getting 'TypeError: cannot read property of undefined' in JavaScript
```

The agent will:
1. Use Gemini to understand the query.
2. Call the `search_by_error` tool on your MCP server.
3. Print the best Stack Overflow answers to your terminal.

---

## Code Highlights

**Tool Definition:**
````js
const searchByErrorTool = new DynamicStructuredTool({
  name: "search_by_error",
  description: "Search Stack Overflow for error-related questions",
  schema: z.object({
    errorMessage: z.string(),
    language: z.string().optional(),
    // ...
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

## License

MIT

---

## Author
