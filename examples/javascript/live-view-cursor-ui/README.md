# Agent pointer in Browserbase Live View

This standalone example puts a Browserbase Live View inside a local page. It draws a black pointer with a white edge and blue glow for automated mouse actions. Human mouse and keyboard input go directly to the Live View iframe. The overlay does not intercept human input.

> [!CAUTION]
> Demo and reference code only. Review the code and validate it for your site before production use.

## Run

Use Node.js 22.18 or newer. From the cookbook root:

```sh
cd examples/javascript/live-view-cursor-ui
npm install
cp .env.example .env
```

Set `BROWSERBASE_API_KEY` in `.env`, then run:

```sh
npm start
```

Open `http://127.0.0.1:4790` on the same computer. The server starts a 15-minute Browserbase session on [SauceDemo](https://www.saucedemo.com/). Click and type in the Live View to use its normal human pointer. Select **Run Playwright** or **Run Stagehand** to sign in and add Sauce Labs Backpack to the cart. These runs show the custom agent pointer. The Stagehand run uses a direct locator click if its model action does not add the item. Select **New session** to reset the demo after a session ends.

The demo uses SauceDemo's published test account. It adds one item to a test cart. It does not place an order. Stagehand uses the Browserbase Model Gateway and makes a model call. The server releases the Browserbase session when it shuts down. Browserbase selects the project from the API key.

## When the agent pointer moves

The overlay receives `mousemove` and `mousedown` events from the remote page while an automated run is active. These commands move it:

- Playwright `page.mouse.move()`, `page.mouse.click()`, `locator.hover()`, and `locator.click()`.
- Stagehand actions that move or click the mouse, including `stagehand.act()` when it uses a real mouse action and Stagehand locator clicks.

`fill()`, text insertion, keyboard commands, `page.evaluate(() => element.click())`, and `dispatchEvent("click")` do not make a mouse path. They do not move the pointer. This example marks runs started by its two buttons as agent activity. If you add your own script, run its mouse actions inside the same active-run state or send their positions to the overlay.

The direct Browserbase Live View URL keeps its normal pointer. The custom agent pointer appears only in this UI. The server binds to `127.0.0.1`; it sends the signed Live View URL to the local page, and it keeps the Browserbase API key on the server. If you deploy the UI, protect the page and its API routes because the page receives a signed Live View URL.

## Human input and pointer delay

Human clicks, typing, and scrolling stay in the Browserbase Live View. They do not pass through this example's server. The agent pointer is a visual overlay with `pointer-events: none`, so it does not block human input.

The UI reads the latest agent position from `/api/pointer` every 100 ms. This also works when a proxy holds Server-Sent Events instead of passing them through. The agent pointer can have some display delay, but this path does not delay human input. Browserbase's [performance guide](https://docs.browserbase.com/optimizations/latency/speed-optimization) explains how region choice affects automation command round trips.

## Change the target

Change the `page.goto()` call in `createSession()` and the browser steps in `runAgent()` in [`server.mjs`](server.mjs). The viewer is set to 1280 × 800 pixels. Change both the server viewport and UI aspect ratio if you use another size. This example tracks mouse events in the main remote tab. A new remote tab or a frame inside the remote page needs its own pointer listener.
