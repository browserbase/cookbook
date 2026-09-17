import { StagehandCreateOptionsSchema } from "@browserbasehq/stagehand";
import { Stagehand, browserbase, localBrowser } from "@browserbasehq/stagehand";
import { Browserbase } from "@browserbasehq/sdk";
import { z } from "zod";
import { runBrowserTask } from "../../../../browser-task";
import { createRequestLifecycle } from "./route-lifecycle";

export const maxDuration = 300;

function sendEvent(
  controller: ReadableStreamDefaultController,
  data: Record<string, unknown>,
) {
  controller.enqueue(
    new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
  );
}

// Map agent tool names to friendly display info
// Returns null for tools that should be hidden from the user
export function getToolDisplay(
  toolName: string,
  args: Record<string, unknown>,
): { icon: string; message: string; toolName: string } | null {
  // Hide internal tools that don't make sense to show users
  if (toolName === "ariaTree" || toolName === "screenshot") {
    return null;
  }

  const toolMap: Record<string, { icon: string; label: string }> = {
    navigate: { icon: "🌐", label: "Navigating" },
    act: { icon: "🖱", label: "Performing action" },
    extract: { icon: "📊", label: "Extracting data" },
    scroll: { icon: "📜", label: "Scrolling" },
    keys: { icon: "⌨️", label: "Typing" },
    navback: { icon: "◀️", label: "Going back" },
    think: { icon: "💭", label: "Thinking" },
    wait: { icon: "⏳", label: "Waiting" },
    finish: { icon: "✅", label: "Task complete" },
    fillForm: { icon: "📝", label: "Filling form" },
    search: { icon: "🔎", label: "Searching" },
  };

  const display = toolMap[toolName] || { icon: "⚙️", label: toolName };
  let message = display.label;

  if (toolName === "navigate" && args.url) {
    const urlStr = String(args.url);
    // Show just the domain for cleaner display
    try {
      const domain = new URL(urlStr).hostname;
      message = `Navigating to ${domain}`;
    } catch {
      message = `Navigating to ${urlStr.substring(0, 50)}`;
    }
  } else if (toolName === "act" && args.instruction) {
    const s = String(args.instruction);
    message = s.length > 80 ? s.substring(0, 80) + "..." : s;
  } else if (toolName === "extract" && args.instruction) {
    const s = String(args.instruction);
    message = `Extracting: ${s.length > 60 ? s.substring(0, 60) + "..." : s}`;
  } else if (toolName === "scroll") {
    const dir = args.direction ? String(args.direction) : "down";
    message = `Scrolling ${dir}`;
  } else if (toolName === "keys") {
    // keys tool uses "method" (press/type) and "value"
    const method = String(args.method || "press");
    const value = String(args.value || "");
    if (method === "type" && value) {
      message = `Typing "${value.length > 40 ? value.substring(0, 40) + "..." : value}"`;
    } else if (value) {
      message = `Pressing ${value}`;
    }
  } else if (toolName === "think" && args.reasoning) {
    const s = String(args.reasoning);
    message = s.length > 120 ? s.substring(0, 120) + "..." : s;
  } else if (toolName === "finish") {
    const reason = args.message;
    if (reason) {
      const s = String(reason);
      message = s.length > 100 ? s.substring(0, 100) + "..." : s;
    }
  }

  return { icon: display.icon, message, toolName };
}

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const lifecycle = createRequestLifecycle(req.signal);
  let acceptingEvents = true;

  const stream = new ReadableStream({
    async start(controller) {
      let stagehand: Stagehand | null = null;
      const emit = (data: Record<string, unknown>) => {
        if (!acceptingEvents || lifecycle.aborted) return;
        sendEvent(controller, data);
      };

      try {
        if (lifecycle.aborted) return;
        emit({
          type: "status",
          message: "Initializing browser session...",
        });

        stagehand = await Stagehand.create(
          StagehandCreateOptionsSchema.parse({
            browser: await browserbase.launch({
              apiKey: process.env.BROWSERBASE_API_KEY!,
              ...{
                proxies: true,
                region: "us-west-2",
                browserSettings: {
                  blockAds: true,
                  viewport: { width: 1280, height: 720 },
                },
              },
            }),
          }),
        );
        await lifecycle.own(stagehand);
        if (lifecycle.aborted) return;

        const sessionId = stagehand.browser.sessionId;

        // Get debug URL for live view
        const bb = new Browserbase({
          apiKey: process.env.BROWSERBASE_API_KEY!,
        });
        const debugInfo = await bb.sessions.debug(sessionId!);
        const debugUrl = debugInfo.debuggerFullscreenUrl;

        emit({
          type: "session",
          message: "Browser session started",
          sessionId,
          debugUrl,
        });

        // Create the agent
        const agent = (task: Parameters<typeof runBrowserTask>[1]) =>
          runBrowserTask(stagehand!, task, {
            systemPrompt: `You are a real estate search assistant. You browse property research portal to find properties matching user criteria. Be thorough with filters and scroll through results before extracting data.`,
          });

        emit({
          type: "status",
          message: "Agent started, browsing property research portal...",
        });

        // Execute the agent with a single instruction and output schema
        const result = await agent({
          instruction: `Go to property.example.invalid and search for properties based on this request: "${prompt}"

Steps:
1. Navigate to property.example.invalid
2. If any popup or modal appears (like "What type of listings would you like to see?"), dismiss it by clicking "Skip this question" or any close button
3. Click the search bar and type the location from the user's request
4. Select the best matching suggestion from the dropdown, or press Enter
5. If any popup appears on the results page, dismiss it
6. Apply price filters if the user specified a budget (click the price filter button, set max price, apply)
7. Apply bedroom filters if the user specified bedrooms (click beds & baths filter, select minimum beds, apply)
8. Scroll down through the listings to load more results
9. Extract all visible property listings with their details
10. You're done!`,
          maxSteps: 30,
          output: z.object({
            listings: z.array(
              z.object({
                address: z.string().describe("Full street address"),
                price: z.string().describe("Listed price"),
                beds: z.string().describe("Number of bedrooms"),
                baths: z.string().describe("Number of bathrooms"),
                sqft: z.string().describe("Square footage"),
                link: z
                  .string()
                  .describe("URL to the listing, or empty string"),
                details: z
                  .string()
                  .describe(
                    "Notable details: listing status, open house, price cuts, etc.",
                  ),
              }),
            ),
          }),
          callbacks: {
            onStepFinish: async (event) => {
              // Stream reasoning text
              if (event.text && event.text.length > 0) {
                emit({
                  type: "thought",
                  message: event.text.substring(0, 200),
                });
              }

              // Stream each tool call as an action
              if (event.toolCalls && event.toolCalls.length > 0) {
                for (const toolCall of event.toolCalls) {
                  const args = ((toolCall as Record<string, unknown>).input ||
                    {}) as Record<string, unknown>;
                  const display = getToolDisplay(toolCall.toolName, args);

                  // Skip hidden tools (ariaTree, screenshot, etc.)
                  if (!display) continue;

                  emit({
                    type: display.toolName === "think" ? "thought" : "action",
                    message: display.message,
                    toolName: display.toolName,
                    icon: display.icon,
                  });
                }
              }
            },
          },
          abortSignal: lifecycle.signal,
        });

        if (lifecycle.aborted) return;

        // Send the extracted results
        const output = result.output as
          { listings: Array<Record<string, string>> } | undefined;
        const listings = output?.listings || [];

        if (listings.length > 0) {
          emit({
            type: "result",
            message: `Extracted ${listings.length} listings`,
            data: listings,
          });
        }

        emit({
          type: "done",
          outcome: result.completed ? "completed" : "incomplete",
          message: result.completed
            ? `Done! Found ${listings.length} properties matching your criteria.`
            : `Agent finished. ${result.message}`,
        });
      } catch (error) {
        if (lifecycle.aborted) return;
        emit({
          type: "error",
          message: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
        emit({
          type: "done",
          outcome: "error",
          message: "Session ended with error",
        });
      } finally {
        await lifecycle.cleanup();
        if (acceptingEvents) {
          acceptingEvents = false;
          controller.close();
        }
      }
    },
    async cancel() {
      acceptingEvents = false;
      await lifecycle.cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
