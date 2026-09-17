import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const App = lazy(() => import("../app"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BTC Async & Network Lab" },
      { name: "description", content: "Async + network benchmark lab." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <ClientOnly fallback={<div />}>
      <Suspense fallback={<div />}>
        <App />
      </Suspense>
    </ClientOnly>
  );
}
