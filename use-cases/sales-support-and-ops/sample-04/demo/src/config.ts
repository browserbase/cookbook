import "dotenv/config";
import { Config, ConfigSchema } from "./types.js";

export const config: Config = {
  browserbase: {
    apiKey: process.env.BROWSERBASE_API_KEY || "",
    projectId: process.env.BROWSERBASE_PROJECT_ID || "",
  },
  gemini: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
  work_app: {
    email: process.env.WORK_APP_EMAIL || "",
    password: process.env.WORK_APP_PASSWORD || "",
  },
  automation: {
    targetUrl: "https://work_app.com/signup",
    timeout: 60000, // 60 seconds
    metricsPollingInterval: 1500, // 1.5 seconds
  },
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "localhost",
  },
  branding: {
    colors: {
      primary: "#7B68EE", // WorkApp purple
      secondary: "#49CCF9", // WorkApp blue
      accent: "#FF6900", // Orange for alerts
      dark: "#1a1a1a",
      light: "#f8f9fa",
    },
    fonts: {
      primary: "Inter, sans-serif", // WorkApp uses Inter
    },
  },
};

export function validateConfig(): void {
  try {
    ConfigSchema.parse(config);
  } catch (error) {
    console.error("Configuration validation failed:");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}
