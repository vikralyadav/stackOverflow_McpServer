
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

const STACKOVERFLOW_API = "https://api.stackexchange.com/2.3";
const DEFAULT_FILTER = "!*MZqiDl8Y0c)yVzXS";
const ANSWER_FILTER = "!*MZqiDl8Y0c)yVzXS";
const COMMENT_FILTER = "!*Mg-gxeRLu";

const MAX_REQUESTS_PER_WINDOW = 30;
const RATE_LIMIT_WINDOW_MS = 60000;
const RETRY_AFTER_MS = 2000;

class StackOverflowServer {
  constructor() {
    this.server = new Server(
      { 
        name: "stackoverflow-mcp", 
        version: "0.1.0"
       },
      { 
        capabilities: { 
          tools: {} 
        }
       }
    );

    this.apiKey = undefined;
    this.accessToken = undefined;
    this.requestTimestamps = [];

    this.setupTools();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_by_error",
          description: "Search Stack Overflow for error-related questions",
          inputSchema: {
            type: "object",
            properties: {
              errorMessage: { type: "string" },
              language: { type: "string" },
              technologies: { type: "array", items: { type: "string" } },
              minScore: { type: "number" },
              includeComments: { type: "boolean" },
              responseFormat: {
                type: "string",
                enum: ["json", "markdown"],
              },
              limit: { type: "number" },
            },
            required: ["errorMessage"],
          },
        },
        {
          name: "search_by_tags",
          description: "Search Stack Overflow questions by tags",
          inputSchema: {
            type: "object",
            properties: {
              tags: { type: "array", items: { type: "string" } },
              minScore: { type: "number" },
              includeComments: { type: "boolean" },
              responseFormat: {
                type: "string",
                enum: ["json", "markdown"],
              },
              limit: { type: "number" },
            },
            required: ["tags"],
          },
        },
        {
          name: "analyze_stack_trace",
          description: "Analyze stack trace and find relevant solutions",
          inputSchema: {
            type: "object",
            properties: {
              stackTrace: { type: "string" },
              language: { type: "string" },
              includeComments: { type: "boolean" },
              responseFormat: {
                type: "string",
                enum: ["json", "markdown"],
              },
              limit: { type: "number" },
            },
            required: ["stackTrace", "language"],
          },
        },
      ],
    }));


    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!args) {
        throw new McpError(ErrorCode.InvalidParams, "Arguments are required");
      }

      switch (name) {
        case "search_by_error":
          if (!args.errorMessage) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "errorMessage is required"
            );
          }
          return this.handleSearchByError(args);

        case "search_by_tags":
          if (!args.tags) {
            throw new McpError(ErrorCode.InvalidParams, "tags are required");
          }
          return this.handleSearchByTags(args);

        case "analyze_stack_trace":
          if (!args.stackTrace || !args.language) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "stackTrace and language are required"
            );
          }
          return this.handleAnalyzeStackTrace(args);

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  checkRateLimit() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS
    );

    if (this.requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      return false;
    }
    this.requestTimestamps.push(now);
    return true;
  }

  async withRateLimit(fn, retries = 3) {
    if (!this.checkRateLimit()) {
      console.warn("Rate limit exceeded, waiting before retry...");
      await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
      return this.withRateLimit(fn, retries);
    }

    try {
      return await fn();
    } catch (error) {
      if (
        retries > 0 &&
        (String(error).includes("429") || error?.status === 429)
      ) {
        console.warn("Rate limit hit (429), retrying...");
        await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
        return this.withRateLimit(fn, retries - 1);
      }
      throw error;
    }
  }

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

    if (this.apiKey) params.append("key", this.apiKey);
    if (this.accessToken) params.append("access_token", this.accessToken);

    const response = await this.withRateLimit(() =>
      fetch(`${STACKOVERFLOW_API}/search/advanced?${params}`)
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Stack Overflow API error: ${errorData.error_message}`
      );
    }

    const data = await response.json();
    const results = [];

    for (const question of data.items) {
      if (options.minScore && question.score < options.minScore) continue;

      const answers = await this.fetchAnswers(question.question_id);
      let comments;

      if (options.includeComments) {
        comments = {
          question: await this.fetchComments(question.question_id),
          answers: {},
        };

        for (const answer of answers) {
          if (answer.answer_id) {
            comments.answers[answer.answer_id] = await this.fetchComments(
              answer.answer_id
            );
          }
        }
      }

      results.push({ question, answers, ...(comments && { comments }) });
    }

    return results;
  }

  async fetchAnswers(questionId) {
    const params = new URLSearchParams({
      site: "stackoverflow",
      filter: ANSWER_FILTER,
      sort: "votes",
      order: "desc",
    });

    const response = await this.withRateLimit(() =>
      fetch(`${STACKOVERFLOW_API}/questions/${questionId}/answers?${params}`)
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Stack Overflow API error: ${errorData.error_message}`
      );
    }

    const data = await response.json();
    return data.items || [];
  }

  async fetchComments(postId) {
    const params = new URLSearchParams({
      site: "stackoverflow",
      filter: COMMENT_FILTER,
      sort: "votes",
      order: "desc",
    });

    const response = await this.withRateLimit(() =>
      fetch(`${STACKOVERFLOW_API}/posts/${postId}/comments?${params}`)
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Stack Overflow API error: ${errorData.error_message}`
      );
    }

    const data = await response.json();
    return data.items || [];
  }

  formatResponse(results, format = "json") {
    if (format === "json") {
      return JSON.stringify(results, null, 2);
    }

    return results
      .map((result) => {
        let md = `# ${result.question.title}\n\n`;
        md += `**Score:** ${result.question.score} | **Answers:** ${result.question.answer_count}\n\n`;
        md += `## Question\n\n${result.question.body}\n\n`;

        if (result.comments?.question) {
          md += "### Question Comments\n\n";
          result.comments.question.forEach((c) => {
            md += `- ${c.body} *(Score: ${c.score})*\n`;
          });
          md += "\n";
        }

        md += "## Answers\n\n";
        result.answers.forEach((a) => {
          md += `### ${a.is_accepted ? "✓ " : ""}Answer (Score: ${a.score})\n\n`;
          md += `${a.body}\n\n`;

          if (result.comments?.answers[a.answer_id]) {
            md += "#### Answer Comments\n\n";
            result.comments.answers[a.answer_id].forEach((c) => {
              md += `- ${c.body} *(Score: ${c.score})*\n`;
            });
            md += "\n";
          }
        });

        md += `---\n\n[View on Stack Overflow](${result.question.link})\n\n`;
        return md;
      })
      .join("\n\n");
  }

  async handleSearchByError(args) {
    const tags = [
      ...(args.language ? [args.language.toLowerCase()] : []),
      ...(args.technologies || []),
    ];

    const results = await this.searchStackOverflow(
      args.errorMessage,
      tags.length > 0 ? tags : undefined,
      {
        minScore: args.minScore,
        limit: args.limit,
        includeComments: args.includeComments,
      }
    );

    return {
      content: [{ type: "text", text: this.formatResponse(results, args.responseFormat) }],
    };
  }

  async handleSearchByTags(args) {
    const params = new URLSearchParams({
      site: "stackoverflow",
      sort: "votes",
      order: "desc",
      filter: "!nKzQUR30W7",
      tagged: args.tags.join(";"),
      ...(args.limit && { pagesize: String(args.limit) }),
    });

    const response = await this.withRateLimit(() =>
      fetch(`${STACKOVERFLOW_API}/questions?${params}`)
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Stack Overflow API error: ${errorData.error_message}`
      );
    }

    const data = await response.json();
    const results = [];

    for (const question of data.items) {
      if (args.minScore && question.score < args.minScore) continue;

      const answers = await this.fetchAnswers(question.question_id);
      let comments;

      if (args.includeComments) {
        comments = {
          question: await this.fetchComments(question.question_id),
          answers: {},
        };

        for (const answer of answers) {
          if (answer.answer_id) {
            comments.answers[answer.answer_id] = await this.fetchComments(
              answer.answer_id
            );
          }
        }
      }

      results.push({ question, answers, ...(comments && { comments }) });
    }

    return {
      content: [{ 
        type: "text", 
        text: this.formatResponse(results, args.responseFormat) 
      }],
    };
  }

  async handleAnalyzeStackTrace(args) {
    const errorLines = args.stackTrace.split("\n");
    const errorMessage = errorLines[0];

    const results = await this.searchStackOverflow(errorMessage, [args.language.toLowerCase()], {
      minScore: 0,
      limit: args.limit,
      includeComments: args.includeComments,
    });

    return {
      content: [{
         type: "text", 
         text: this.formatResponse(results, args.responseFormat) }],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Stack Overflow MCP server running on stdio");
  }
}

const server = new StackOverflowServer();
server.run().catch(console.error);
