// Re-export tool registration functions from their respective files.
// This allows for cleaner imports in MyMCP.ts (e.g., import { registerCalculatorTools } from '../tools';)
export { registerCalculatorTools } from './calculator';
export { registerGoogleSheetsTools } from './google-sheets';
