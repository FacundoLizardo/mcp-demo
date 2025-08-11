/**
 * Defines the structure of the environment variables expected by the Cloudflare Worker
 * and specifically, by the MyMCP Durable Object.
 * These variables are critical for Google API authentication.
 */
export interface Env {
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI: string;
    GOOGLE_REFRESH_TOKEN: string;
}
