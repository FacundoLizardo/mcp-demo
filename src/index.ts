// src/index.ts - Main Cloudflare Worker Entry Point

import { MyMCP } from './agents/MyMCP'; // Import your MyMCP Durable Object class
import { Env } from './types/env';     // Import the Env interface


// Export the MyMCP Durable Object class.
// This is crucial for Cloudflare Workers to correctly identify and bind the Durable Object.
export { MyMCP };

/**
 * The default fetch handler for the Cloudflare Worker.
 * This function serves as the entry point for all incoming HTTP requests.
 * It routes requests to either the SSE handler or the MCP agent handler.
 * @param request The incoming HTTP request.
 * @param env The environment variables and bound resources for the Worker.
 * @param ctx The execution context, providing utilities like waitUntil.
 * @returns A Response object for the incoming request.
 */
export default {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
        const url = new URL(request.url);

        // Route requests to the Server-Sent Events (SSE) handler.
        // SSE is used for real-time, one-way communication from the server to the client,
        // often used for streaming agent responses or updates.
        if (url.pathname === "/sse" || url.pathname === "/sse/message") {
            // MyMCP.serveSSE creates a handler for SSE connections.
            return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
        }

        // Route requests to the Model Context Protocol (MCP) agent handler.
        // This is the primary endpoint for interacting with your agent,
        // sending tool invocation requests.
        if (url.pathname === "/mcp") {
            // MyMCP.serve creates a handler for MCP protocol requests.
            return MyMCP.serve("/mcp").fetch(request, env, ctx);
        }

        // For any other unhandled paths, return a 404 Not Found response.
        return new Response("Not found", { status: 404 });
    },
};
