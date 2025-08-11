// src/agent/MyMCP.ts

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { google } from 'googleapis'; // Google API client library

import { Env } from '../types/env'; // Import the Env interface
import { registerCalculatorTools, registerGoogleSheetsTools } from '../tools'; // Import tool registration functions

// Declare DurableObjectState and DurableObjectStorage types if not globally available.
// These types are part of the Cloudflare Workers runtime API.
// If your TypeScript compiler complains about these types, uncomment them.
/*
declare class DurableObjectState {
    blockConcurrencyWhile(f: () => Promise<void>): Promise<void>;
    waitUntil(promise: Promise<any>): void;
    storage: DurableObjectStorage;
}
declare class DurableObjectStorage {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    list<T>(options?: { start?: string; end?: string; prefix?: string; reverse?: boolean; limit?: number; }): Promise<Map<string, T>>;
}
*/

/**
 * MyMCP class extends McpAgent. It initializes the MCP server, sets up
 * Google API authentication, and registers all agent tools.
 */
export class MyMCP extends McpAgent {
    server = new McpServer({
        name: "Google Sheets Data Agent", // Updated agent name for clarity
        version: "1.0.0",
    });

    env: Env; // Strongly typed environment variables.
    private sheetsClient: any; // Google Sheets API client.

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.env = env;
    }

    /**
     * The asynchronous initialization method for the agent.
     * This method sets up authentication and registers all tools.
     */
    async init() {
        // 1. Setup Google Sheets API Authentication
        const auth = new google.auth.OAuth2(
            this.env.GOOGLE_CLIENT_ID,
            this.env.GOOGLE_CLIENT_SECRET,
            this.env.GOOGLE_REDIRECT_URI
        );

        auth.setCredentials({
            refresh_token: this.env.GOOGLE_REFRESH_TOKEN,
        });

        try {
            const { credentials } = await auth.refreshAccessToken();
            auth.setCredentials(credentials);
            console.log("Access token refreshed successfully.");
        } catch (error) {
            console.error("Error refreshing access token. Check GOOGLE_REFRESH_TOKEN:", error);
            // Re-throw or handle as appropriate for your application
            throw new Error("Failed to refresh Google access token. Please check credentials.");
        }

        this.sheetsClient = google.sheets({ version: 'v4', auth });

        // 2. Register Tools
        // Call the imported functions to register specific groups of tools.
        registerCalculatorTools(this.server); // Register calculator tools.
        registerGoogleSheetsTools(this.server, this.sheetsClient); // Register Google Sheets tools, passing the client.

        console.log("MyMCP agent initialized and all tools registered.");
    }
}
