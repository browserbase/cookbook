import { browserbase } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

dotenv.config();

export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || "3000", 10),

  // Browserbase Configuration
  browserbase: {
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      advancedStealth: true,
    },
    proxies: true,
  },

  // Stagehand Configuration
  stagehand: async () => ({
    browser: await browserbase.launch({
      apiKey: process.env.BROWSERBASE_API_KEY!,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
    }),
    model: {
      modelName: "google/gemini-3.6-flash",
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    },
  }),

  // Automation Configuration
  automation: {
    targetUrl: "https://www.anthem.com/ca/find-care/",
    maxRetries: 3,
    pageLoadTimeout: 60000, // Increased to 60 seconds
    actionTimeout: 10000,
    humanInputTimeout: 300000, // 5 minutes
    pollInterval: 1000, // 1 second
  },

  // Sample Organization Brand Colors
  branding: {
    colors: {
      primary: "#FF6900",
      secondary: "#B9C9FF",
      accent: "#777620",
      dark: "#1a1a1a",
      light: "#f8f9fa",
    },
    fonts: {
      primary: "Montserrat, sans-serif",
    },
  },
};

// Validate required environment variables
export function validateConfig() {
  const required = ["BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please copy .env.example to .env and fill in your credentials.",
    );
  }

  // Check for Gemini API key
  const hasGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!hasGeminiKey) {
    throw new Error(
      "GEMINI_API_KEY (or GOOGLE_API_KEY) is required for AI model",
    );
  }
}
