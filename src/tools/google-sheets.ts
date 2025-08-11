import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { google } from 'googleapis'; // Google API client library

/**
 * Registers all Google Sheets related tools with the MCP server.
 * This function serves as a centralized point to define all interactions
 * your agent will have with Google Sheets.
 * @param server The McpServer instance to register tools with. Tools are registered
 * onto this server instance so the agent can discover and invoke them.
 * @param sheetsClient The initialized and authenticated Google Sheets API client.
 * This client is essential for making actual requests to the Google Sheets API.
 */
export function registerGoogleSheetsTools(server: McpServer, sheetsClient: any) {

    /**
     * Tool: 'get_spreadsheet_data'
     * Fetches all data from a specified Google Sheet and a given A1 notation range.
     * This is useful for retrieving entire datasets or specific blocks of cells.
     * @param {string} spreadsheetId The unique identifier of the Google Sheet to extract data from.
     * @param {string} range The A1 notation of the range to retrieve (e.g., 'Sheet1!A1:C10', 'Sheet2!B:B', 'MyData!1:1').
     * @returns {Object} An object containing the content retrieved, typically as a JSON string of rows,
     * or an error message if the operation fails or no data is found.
     */
    server.tool(
        "get_spreadsheet_data",
        z.object({
            spreadsheetId: z.string().describe("The ID of the Google Sheet to extract data from."),
            range: z.string().describe("The A1 notation of the range to retrieve (e.g., 'Sheet1!A1:C10', 'Sheet2!B:B')."),
        }).shape,
        async ({ spreadsheetId, range }) => {
            try {
                // Make the API call to get values from the specified spreadsheet and range.
                const response = await sheetsClient.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId, // The ID of the Google Sheet.
                    range: range, // The A1 notation range (e.g., "Sheet1!A1:Z").
                });

                const rows = response.data.values; // Extract the array of rows (data) from the response.

                // Check if data was returned and process it.
                if (rows && rows.length) {
                    // If data is found, convert it to a JSON string and return it as text content.
                    // This makes the structured data easily consumable by the agent.
                    return {
                        content: [{ type: "text", text: JSON.stringify(rows) }],
                    };
                } else {
                    // If no data is found in the specified range, return an informative message.
                    return {
                        content: [{ type: "text", text: "No data found in the specified range." }],
                    };
                }
            } catch (error: any) {
                // Catch and log any errors that occur during the API call (e.g., 404 Not Found for invalid ID/range, permission issues).
                console.error("Error fetching spreadsheet data:", error);
                // Return the error message to the agent for debugging or user feedback.
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                };
            }
        }
    );

    /**
     * Tool: 'get_spreadsheet_row_by_id'
     * Fetches a single row from a Google Sheet by searching for a specific
     * ID value within a designated column. This is ideal for retrieving
     * a specific record from a dataset.
     * @param {string} spreadsheetId The unique identifier of the Google Sheet.
     * @param {string} sheetName The exact name of the sheet (tab) within the spreadsheet (e.g., 'Users', 'Products').
     * @param {string} idColumn The single letter of the column containing the unique IDs (e.g., 'A' for column A, 'C' for column C).
     * @param {string} idValue The specific ID value to search for in the specified idColumn.
     * @returns {Object} An object containing the found row as a JSON string,
     * or a message indicating the row was not found or an error occurred.
     */
    server.tool(
        "get_spreadsheet_row_by_id",
        z.object({
            spreadsheetId: z.string().describe("The ID of the Google Sheet."),
            sheetName: z.string().describe("The exact name of the sheet within the spreadsheet (e.g., 'Users', 'Products')."),
            idColumn: z.string().describe("The letter of the column containing the unique IDs (e.g., 'A' for column A, 'C' for column C)."),
            idValue: z.string().describe("The specific ID value to search for in the idColumn."),
        }).shape,
        async ({ spreadsheetId, sheetName, idColumn, idValue }) => {
            try {
                // 1. Fetch all data from the specified sheet.
                // We fetch the entire sheet (or a very large range like A:Z) because
                // Google Sheets API doesn't offer direct "search by value" functionality.
                // We need to iterate through the data in our Worker.
                const range = `${sheetName}!A:Z`; // Assuming data is within columns A to Z. Adjust if your data is wider.
                const response = await sheetsClient.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: range,
                });

                const allRows = response.data.values; // All rows from the sheet.

                // If no data is returned from the sheet, return a message.
                if (!allRows || allRows.length === 0) {
                    return {
                        content: [{ type: "text", text: `No data found in sheet '${sheetName}'.` }],
                    };
                }

                // Determine the 0-based index of the ID column (e.g., 'A' is 0, 'B' is 1).
                // This converts the column letter (e.g., 'A') to its numerical position.
                const idColumnIndex = idColumn.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);

                let foundRow = null; // Variable to store the matching row.
                // Iterate through rows to find the matching ID.
                // Note: Google Sheets row numbers are 1-based, array indices are 0-based.
                for (let i = 0; i < allRows.length; i++) {
                    const row = allRows[i];
                    // Check if the current row has a value in the ID column and if it matches the idValue.
                    // Trim and convert to lowercase for robust, case-insensitive matching.
                    if (row[idColumnIndex] && String(row[idColumnIndex]).trim().toLowerCase() === idValue.trim().toLowerCase()) {
                        foundRow = row; // Store the entire matching row.
                        break; // Found the row, so we can stop searching.
                    }
                }

                // Return the result of the search.
                if (foundRow) {
                    // If a row is found, convert it to a JSON string and return it.
                    return {
                        content: [{ type: "text", text: JSON.stringify(foundRow) }],
                    };
                } else {
                    // If no row is found with the given ID, return an informative message.
                    return {
                        content: [{ type: "text", text: `Row with ID '${idValue}' not found in column '${idColumn}' of sheet '${sheetName}'.` }],
                    };
                }
            } catch (error: any) {
                // Catch and log any errors that occur during the API call or data processing.
                console.error("Error fetching specific row by ID:", error);
                // Return the error message to the agent.
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                };
            }
        }
    );

    /**
     * Tool: 'create_spreadsheet_row'
     * Appends a new row of data to the first available empty row in the specified Google Sheet.
     * This is ideal for adding new records or entries.
     * @param {string} spreadsheetId The unique identifier of the Google Sheet.
     * @param {string} sheetName The exact name of the sheet within the spreadsheet (e.g., 'Inventory', 'Products').
     * @param {number} ID The unique numerical ID for the product/item.
     * @param {string} name The name of the product/item.
     * @param {string} size The size of the product/item (e.g., 'M', 'XL', 'One Size').
     * @param {string} color The color of the product/item.
     * @param {number} stock The current stock quantity of the product.
     * @param {number} price The price of the product.
     * @param {string} category The category of the product (e.g., 'Apparel', 'Electronics').
     * @param {string} description A brief description of the product.
     * @returns {Object} A success message indicating the appended range, or an error message if creation fails.
     */
    server.tool(
        "create_spreadsheet_row",
        z.object({
            spreadsheetId: z.string().describe("The ID of the Google Sheet."),
            sheetName: z.string().describe("The exact name of the sheet within the spreadsheet (e.g., 'Inventory', 'Products')."),
            ID: z.number().describe("The unique numerical ID for the product/item."),
            name: z.string().describe("The name of the product/item."),
            size: z.string().describe("The size of the product/item (e.g., 'M', 'XL', 'One Size')."),
            color: z.string().describe("The color of the product/item."),
            stock: z.number().describe("The current stock quantity of the product (number)."),
            price: z.number().describe("The price of the product (number)."),
            category: z.string().describe("The category of the product (e.g., 'Apparel', 'Electronics')."),
            description: z.string().describe("A brief description of the product."),
        }).shape,
        async ({ spreadsheetId, sheetName, ID, name, size, color, stock, price, category, description }) => {
            try {
                // Define the values for the new row as an array.
                // The order of these values MUST match the column order in your Google Sheet.
                const values = [
                    ID,
                    name,
                    size,
                    color,
                    stock,
                    price,
                    category,
                    description
                ];

                // The range to append to. Using the sheet name followed by "A1" ensures
                // that data is appended to the first available row at the end of the sheet.
                const range = `${sheetName}!A1`;

                // The 'valueInputOption' determines how the input data is interpreted.
                // "USER_ENTERED" means values are parsed as if manually entered into the UI,
                // converting numbers to numbers, etc., and evaluating formulas.
                const valueInputOption = "USER_ENTERED";

                // Make the API call to append the new row to the sheet.
                const response = await sheetsClient.spreadsheets.values.append({
                    spreadsheetId: spreadsheetId,
                    range: range,
                    valueInputOption: valueInputOption,
                    resource: {
                        values: [values], // 'values' property expects an array of rows (even if it's just one row).
                    },
                });

                // Check if the append operation was successful (HTTP status 200).
                if (response.status === 200) {
                    // The 'updates' property in the response provides details about the appended row, like its range.
                    const appendedRange = response.data.updates.updatedRange;
                    return {
                        content: [{ type: "text", text: `Row created successfully. Appended to: ${appendedRange}` }],
                    };
                } else {
                    // If the HTTP status is not 200, return a failure message.
                    return {
                        content: [{ type: "text", text: `Failed to create row. Status: ${response.status}` }],
                    };
                }
            } catch (error: any) {
                // Catch and log any errors that occur during the API call (e.g., permission issues).
                console.error("Error creating spreadsheet row:", error);
                // Return the error message to the agent.
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                };
            }
        }
    );

    /**
     * Tool: 'update_spreadsheet_row_by_id'
     * Finds a specific row in a Google Sheet using a unique ID from a designated column
     * and updates specified cell values within that row. This is crucial for modifying
     * existing records.
     * @param {string} spreadsheetId The unique identifier of the Google Sheet.
     * @param {string} sheetName The exact name of the sheet (tab) within the spreadsheet.
     * @param {string} idColumn The single letter of the column containing the unique ID (e.g., 'A', 'C').
     * @param {string} idValue The specific ID value to search for to identify the row to update.
     * @param {Object} updates An object where keys are column letters (e.g., 'B', 'C')
     * and values are the new data for those corresponding columns.
     * Example: `{ "B": "New Name", "E": 120, "G": "Updated Category" }`.
     * @returns {Object} A success message indicating the updated range, or an error message
     * if the row is not found or the update fails.
     */
    server.tool(
        "update_spreadsheet_row_by_id",
        z.object({
            spreadsheetId: z.string().describe("The ID of the Google Sheet."),
            sheetName: z.string().describe("The exact name of the sheet within the spreadsheet."),
            idColumn: z.string().describe("The letter of the column containing the unique ID (e.g., 'A', 'C')."),
            idValue: z.string().describe("The specific ID value to search for to identify the row."),
            updates: z.record(z.string(), z.union([z.string(), z.number()]))
                      .describe("An object where keys are column letters (e.g., 'B', 'C') and values are the new data for those columns."),
        }).shape,
        async ({ spreadsheetId, sheetName, idColumn, idValue, updates }) => {
            try {
                // 1. Fetch all data from the specified sheet to find the row index.
                // We need to retrieve the full sheet data to locate the target row by its ID.
                const fullRange = `${sheetName}!A:Z`; // Fetch entire sheet, adjust 'Z' if your data extends further
                const response = await sheetsClient.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: fullRange,
                });

                const allRows = response.data.values; // All rows from the sheet.

                // If no data is found in the sheet at all, return an informative message.
                if (!allRows || allRows.length === 0) {
                    return {
                        content: [{ type: "text", text: `No data found in sheet '${sheetName}'.` }],
                    };
                }

                // Determine the 0-based index of the ID column (e.g., 'A' is 0, 'B' is 1).
                const idColumnIndex = idColumn.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);

                let rowIndexToUpdate = -1; // Initialize to -1, indicating the row hasn't been found yet.
                let currentRowData = []; // This will hold the found row's existing data, which we'll then modify.

                // Iterate through each row to find the matching ID.
                // Google Sheets rows are 1-based, but our array 'allRows' is 0-based.
                // If a match is found at allRows[i], the corresponding sheet row number is (i + 1).
                for (let i = 0; i < allRows.length; i++) {
                    const row = allRows[i];
                    // Check if the current row has a value in the ID column and if it matches the idValue.
                    // Trim and convert to lowercase for robust, case-insensitive matching.
                    if (row[idColumnIndex] && String(row[idColumnIndex]).trim().toLowerCase() === idValue.trim().toLowerCase()) {
                        rowIndexToUpdate = i; // Store the 0-based index of the found row.
                        currentRowData = row; // Store the complete existing data for this row.
                        break; // We found the row, so we can stop searching.
                    }
                }

                // If no row with the specified ID was found, return an error message.
                if (rowIndexToUpdate === -1) {
                    return {
                        content: [{ type: "text", text: `Row with ID '${idValue}' not found in column '${idColumn}' of sheet '${sheetName}'.` }],
                    };
                }

                // 2. Apply updates to the existing row data.
                // We'll modify the 'currentRowData' array based on the 'updates' provided.
                // First, ensure 'currentRowData' is long enough to accommodate updates to new columns.
                // This handles cases where you might be updating a column beyond the current row's data length.
                const maxColIndex = Math.max(...Object.keys(updates).map(col => col.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)));
                while (currentRowData.length <= maxColIndex) {
                    currentRowData.push(""); // Pad with empty strings until the row is long enough.
                }

                // Iterate through the 'updates' object to apply new cell values.
                for (const colLetter in updates) {
                    // Ensure the property is directly on the updates object (not inherited).
                    if (Object.prototype.hasOwnProperty.call(updates, colLetter)) {
                        const newCellValue = updates[colLetter]; // The new value for the cell.
                        // Convert the column letter (e.g., 'B') to its 0-based index (e.g., 1).
                        const colIndex = colLetter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
                        // Update the specific cell in the 'currentRowData' array.
                        currentRowData[colIndex] = newCellValue;
                    }
                }

                // 3. Construct the range for the update API call.
                // The range must specify the exact row to update in A1 notation.
                // We use A to Z to cover most standard spreadsheet widths.
                const targetRange = `${sheetName}!A${rowIndexToUpdate + 1}:Z${rowIndexToUpdate + 1}`;

                // 4. Perform the update API call.
                // "USER_ENTERED" means Google will interpret the values (e.g., convert "123" to a number).
                const valueInputOption = "USER_ENTERED";
                const updateResponse = await sheetsClient.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    range: targetRange,
                    valueInputOption: valueInputOption,
                    resource: {
                        values: [currentRowData], // The 'values' property expects an array of rows (even if it's just one modified row).
                    },
                });

                // Check if the update operation was successful (HTTP status 200).
                if (updateResponse.status === 200) {
                    // The 'updatedRange' property in the response indicates which cells were modified.
                    const updatedRange = updateResponse.data.updatedRange;
                    return {
                        content: [{ type: "text", text: `Row with ID '${idValue}' updated successfully. Updated range: ${updatedRange}` }],
                    };
                } else {
                    // If the HTTP status is not 200, return a failure message.
                    return {
                        content: [{ type: "text", text: `Failed to update row with ID '${idValue}'. Status: ${updateResponse.status}` }],
                    };
                }

            } catch (error: any) {
                // Catch and log any errors that occur during the API call or data processing.
                console.error("Error updating spreadsheet row by ID:", error);
                // Return the error message to the agent.
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                };
            }
        }
    );

    /**
     * Tool: 'delete_spreadsheet_row_by_id'
     * Finds a specific row in a Google Sheet using a unique ID and then deletes that entire row.
     * This is useful for removing outdated or incorrect records.
     * @param {string} spreadsheetId The unique identifier of the Google Google Sheet.
     * @param {string} sheetName The exact name of the sheet (tab) within the spreadsheet.
     * @param {string} idColumn The letter of the column containing the unique ID (e.g., 'A', 'C').
     * @param {string} idValue The specific ID value to search for to identify the row to delete.
     * @returns {Object} A success message upon deletion, or an error message if the row is not found or deletion fails.
     */
    server.tool(
        "delete_spreadsheet_row_by_id",
        z.object({
            spreadsheetId: z.string().describe("The ID of the Google Sheet."),
            sheetName: z.string().describe("The exact name of the sheet within the spreadsheet."),
            idColumn: z.string().describe("The letter of the column containing the unique ID (e.g., 'A', 'C')."),
            idValue: z.string().describe("The specific ID value to search for to identify the row to delete."),
        }).shape,
        async ({ spreadsheetId, sheetName, idColumn, idValue }) => {
            try {
                // 1. Get the sheet ID. We need this for the batchUpdate request.
                // Fetching spreadsheet metadata to get the sheetId based on sheetName.
                const spreadsheetMetadata = await sheetsClient.spreadsheets.get({
                    spreadsheetId: spreadsheetId,
                    fields: 'sheets.properties', // Request only sheet properties
                });

                const sheet = spreadsheetMetadata.data.sheets.find(
                    (s: any) => s.properties.title === sheetName
                );

                if (!sheet || !sheet.properties || typeof sheet.properties.sheetId === 'undefined') {
                    return {
                        content: [{ type: "text", text: `Sheet '${sheetName}' not found in spreadsheet.` }],
                    };
                }
                const sheetId = sheet.properties.sheetId; // This is the numerical sheetId needed for deleteDimension.

                // 2. Fetch all data to find the row index to delete.
                // We retrieve the full sheet content to locate the row by ID.
                const fullRange = `${sheetName}!A:Z`; // Assuming data is within columns A to Z
                const response = await sheetsClient.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: fullRange,
                });

                const allRows = response.data.values;

                if (!allRows || allRows.length === 0) {
                    return {
                        content: [{ type: "text", text: `No data found in sheet '${sheetName}'.` }],
                    };
                }

                const idColumnIndex = idColumn.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);

                let rowIndexToDelete = -1; // Initialize to -1 (not found)
                // Iterate through rows to find the matching ID.
                // Remember: allRows array index (i) + 1 gives the Google Sheet row number.
                for (let i = 0; i < allRows.length; i++) {
                    const row = allRows[i];
                    if (row[idColumnIndex] && String(row[idColumnIndex]).trim().toLowerCase() === idValue.trim().toLowerCase()) {
                        rowIndexToDelete = i; // Store the 0-based array index of the row to delete.
                        break;
                    }
                }

                // If no row with the specified ID was found, return an error message.
                if (rowIndexToDelete === -1) {
                    return {
                        content: [{ type: "text", text: `Row with ID '${idValue}' not found in column '${idColumn}' of sheet '${sheetName}'.` }],
                    };
                }

                // 3. Prepare the batch update request for deleting the row.
                // The 'deleteDimension' request specifies which rows to delete.
                const deleteRequest = {
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS', // Specifies that we are deleting rows.
                            startIndex: rowIndexToDelete, // 0-based start index (inclusive).
                            endIndex: rowIndexToDelete + 1, // 0-based end index (exclusive). Deletes one row.
                        },
                    },
                };

                // 4. Execute the batch update API call.
                const batchUpdateResponse = await sheetsClient.spreadsheets.batchUpdate({
                    spreadsheetId: spreadsheetId,
                    resource: {
                        requests: [deleteRequest], // Pass the delete request in an array.
                    },
                });

                // Check if the batch update operation was successful.
                if (batchUpdateResponse.status === 200) {
                    return {
                        content: [{ type: "text", text: `Row with ID '${idValue}' deleted successfully from sheet '${sheetName}'.` }],
                    };
                } else {
                    return {
                        content: [{ type: "text", text: `Failed to delete row with ID '${idValue}'. Status: ${batchUpdateResponse.status}` }],
                    };
                }

            } catch (error: any) {
                // Catch and log any errors that occur during the API call or data processing.
                console.error("Error deleting spreadsheet row by ID:", error);
                // Return the error message to the agent.
                return {
                    content: [{ type: "text", text: `Error: ${error.message}` }],
                };
            }
        }
    );

}
