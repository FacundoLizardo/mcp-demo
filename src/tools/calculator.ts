import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Registers basic calculator tools ('add' and 'calculate') with the MCP server.
 * @param server The McpServer instance to register tools with.
 */
export function registerCalculatorTools(server: McpServer) {
    // Tool: 'add' - Simple addition of two numbers.
    server.tool(
        "add",
        { a: z.number().describe("The first number to add."), b: z.number().describe("The second number to add.") },
        async ({ a, b }) => ({
            content: [{ type: "text", text: String(a + b) }],
        })
    );

    // Tool: 'calculate' - Performs various arithmetic operations.
    server.tool(
        "calculate",
        {
            operation: z.enum(["add", "subtract", "multiply", "divide"])
                        .describe("The arithmetic operation to perform (add, subtract, multiply, or divide)."),
            a: z.number().describe("The first operand."),
            b: z.number().describe("The second operand."),
        },
        async ({ operation, a, b }) => {
            let result: number;
            switch (operation) {
                case "add":
                    result = a + b;
                    break;
                case "subtract":
                    result = a - b;
                    break;
                case "multiply":
                    result = a * b;
                    break;
                case "divide":
                    if (b === 0) {
                        return {
                            content: [{ type: "text", text: "Error: Cannot divide by zero" }],
                        };
                    }
                    result = a / b;
                    break;
            }
            return { content: [{ type: "text", text: String(result) }] };
        }
    );
}
