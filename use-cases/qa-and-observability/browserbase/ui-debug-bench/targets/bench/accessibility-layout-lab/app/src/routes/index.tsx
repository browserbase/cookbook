import { createFileRoute } from "@tanstack/react-router";
import App from "@/app/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BTC Accessibility & Layout Lab" },
      { name: "description", content: "Benchmark suite for a11y and layout bugs." },
    ],
  }),
  component: App,
});
