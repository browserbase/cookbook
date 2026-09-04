"use client";

import { useState, useRef, useEffect } from "react";

import { consumeBrowseStream, BrowseStreamError, type Listing, type LogEntry, type BrowseOutcome } from "./browse-stream";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runOutcome, setRunOutcome] = useState<BrowseOutcome | "idle" | "running">("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);
  const [showLiveView, setShowLiveView] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);
    setRunOutcome("running");
    setLogs([]);
    setListings([]);
    setSessionId(null);
    setDebugUrl(null);
    setShowLiveView(false);

    try {
      const res = await fetch("/api/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const outcome = await consumeBrowseStream(res, (entry) => {
        setLogs((prev) => [...prev, entry]);
        if (entry.type === "session" && entry.sessionId) {
          setSessionId(entry.sessionId);
          if (entry.debugUrl) setDebugUrl(entry.debugUrl);
          setShowLiveView(true);
        }
        if (entry.type === "result" && entry.data) setListings(entry.data);
      });
      setRunOutcome(outcome);
      if (outcome !== "completed") {
        setLogs((prev) => [...prev, {
          type: "error", message: outcome === "interrupted"
            ? "The search ended without completing. Any displayed listings are partial. You can retry."
            : "The search failed. Any displayed listings are partial. You can retry.",
        }]);
      }
    } catch (err) {
      const outcome = err instanceof BrowseStreamError ? err.outcome : "interrupted";
      setRunOutcome(outcome);
      setLogs((prev) => [...prev, { type: "error", message: err instanceof BrowseStreamError
        ? err.message : "The search connection was interrupted. Completion was not confirmed. You can retry." }]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="border-b border-[var(--workspace_app-border)] px-4 py-2 flex items-center gap-2 text-sm text-[var(--workspace_app-text-secondary)]">
        <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
          <path
            d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z"
            fill="#fff"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143C69.893 0.04 68.147 -0.353 61.35 0.227zM25.333 19.12c-5.2 0.33 -6.383 0.39 -9.35 -1.947L8.927 11.507c-0.78 -0.78 -0.39 -1.753 1.357 -1.947l53.193 -3.887c4.467 -0.39 6.793 1.167 8.543 2.527l8.963 6.503c0.39 0.193 1.36 1.36 0.193 1.36l-54.867 3.17 -0.977 -0.113zM19.667 88.617V29.2c0 -2.527 0.78 -3.697 3.113 -3.893l58.937 -3.497c2.14 -0.193 3.113 1.167 3.113 3.693v58.83c0 2.527 -0.39 4.67 -3.9 4.863l-56.413 3.313c-3.503 0.193 -4.85 -0.967 -4.85 -3.893zM74.167 32.893c0.39 1.75 0 3.5 -1.75 3.7l-2.723 0.527v43.41c-2.333 1.36 -4.473 2.14 -6.223 2.14 -2.917 0 -3.693 -0.78 -5.833 -3.503L39.5 53.027v24.14l5.637 1.36s0 3.5 -4.857 3.5L29.333 82.607c-0.39 -0.78 0 -2.723 1.357 -3.11l3.5 -0.973V43.287l-4.857 -0.39c-0.39 -1.75 0.58 -4.277 3.307 -4.473l12.817 -0.78 19.53 29.867V45.317l-4.667 -0.583c-0.39 -2.143 1.163 -3.693 3.11 -3.887l12.637 -0.953z"
            fill="#000"
          />
        </svg>
        <span className="font-medium text-[var(--workspace_app-text)]">Workspace App</span>
        <span className="text-[var(--workspace_app-text-secondary)]">/</span>
        <span>House Hunter Agent</span>
      </div>

      <div className="max-w-6xl mx-auto px-16 py-12">
        {/* Page title */}
        <div className="mb-8">
          <div className="text-4xl mb-1">🏠</div>
          <h1 className="text-4xl font-bold text-[var(--workspace_app-text)] mb-1">
            House Hunter Agent
          </h1>
          <p className="text-[var(--workspace_app-text-secondary)] text-base">
            Tell the agent what kind of house you&apos;re looking for and it
            will browse Zillow for you.
          </p>
        </div>

        {/* Prompt input area */}
        <div className="mb-8">
          <div className="border border-[var(--workspace_app-border)] rounded-lg overflow-hidden focus-within:border-[var(--workspace_app-blue)] focus-within:ring-1 focus-within:ring-[var(--workspace_app-blue)] transition-all">
            <div className="flex items-center gap-3 p-4">
              <div className="flex-shrink-0 w-6 h-6 rounded bg-[var(--workspace_app-blue)] flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Find me 3-bedroom houses in San Francisco under $1.5M with a garage..."
                className="flex-1 outline-none text-base text-[var(--workspace_app-text)] placeholder:text-[var(--workspace_app-text-secondary)] bg-transparent"
                disabled={isRunning}
              />
              <button
                onClick={handleSubmit}
                disabled={isRunning || !prompt.trim()}
                className="flex-shrink-0 px-4 py-1.5 bg-[var(--workspace_app-blue)] text-white text-sm font-medium rounded-md hover:bg-[#1b6ec2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isRunning ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Browsing...
                  </span>
                ) : (
                  "Run Agent"
                )}
              </button>
            </div>
          </div>
        </div>

        {runOutcome !== "idle" && (
          <p role="status" className="mb-4 text-sm">
            {runOutcome === "running" ? "Search running..." : runOutcome === "completed" ? "Search complete." : runOutcome === "error" ? "Search failed. You can retry." : "Search interrupted. Completion was not confirmed. You can retry."}
          </p>
        )}

        {/* Two-panel layout: Live View + Logs */}
        {(showLiveView || logs.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
            {/* Live View */}
            {showLiveView && sessionId && (
              <div className="lg:col-span-3">
                <div className="border border-[var(--workspace_app-border)] rounded-lg overflow-hidden">
                  <div className="bg-[var(--workspace_app-bg-secondary)] px-4 py-2 flex items-center gap-2 border-b border-[var(--workspace_app-border)]">
                    <span
                      className={`w-2 h-2 rounded-full ${isRunning ? "bg-green-500 pulse-dot" : "bg-gray-400"}`}
                    />
                    <span className="text-xs font-medium text-[var(--workspace_app-text-secondary)]">
                      {runOutcome === "running" ? "Live View" : runOutcome === "completed" ? "Search Complete" : runOutcome === "error" ? "Search Failed" : runOutcome === "interrupted" ? "Search Interrupted" : "Session"}
                    </span>
                    <a
                      href={`https://browserbase.com/sessions/${sessionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-xs text-[var(--workspace_app-blue)] hover:underline"
                    >
                      Open in Browserbase
                    </a>
                  </div>
                  <div
                    className="relative bg-black"
                    style={{ aspectRatio: "16/9" }}
                  >
                    {debugUrl ? (
                      <iframe
                        src={debugUrl}
                        className="w-full h-full border-0"
                        allow="clipboard-read; clipboard-write"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        Connecting to browser...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Agent Log */}
            <div
              className={
                showLiveView && sessionId ? "lg:col-span-2" : "lg:col-span-5"
              }
            >
              <div className="border border-[var(--workspace_app-border)] rounded-lg overflow-hidden h-full">
                <div className="bg-[var(--workspace_app-bg-secondary)] px-4 py-2 border-b border-[var(--workspace_app-border)]">
                  <span className="text-xs font-medium text-[var(--workspace_app-text-secondary)]">
                    Agent Log
                  </span>
                </div>
                <div className="p-3 max-h-[400px] overflow-y-auto text-sm space-y-1 bg-[#fafafa]">
                  {logs.map((log, i) => {
                    if (log.type === "action") {
                      const fallbackIconMap: Record<string, string> = {
                        click: "🖱",
                        type: "⌨️",
                        scroll: "📜",
                        navigate: "🌐",
                        goto: "🌐",
                        extract: "📊",
                        screenshot: "📸",
                        done: "✅",
                        act: "🖱",
                        think: "💭",
                        keys: "⌨️",
                        wait: "⏳",
                        fillForm: "📝",
                      };
                      const icon =
                        log.icon || fallbackIconMap[log.toolName || ""] || "⚙️";
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 pl-2 py-0.5 text-[var(--workspace_app-text)] font-mono"
                        >
                          <span className="flex-shrink-0 text-xs mt-0.5">
                            {icon}
                          </span>
                          <span className="break-all text-[13px]">
                            {log.message}
                          </span>
                        </div>
                      );
                    }
                    if (log.type === "thought") {
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 pl-2 py-0.5 text-[var(--workspace_app-text-secondary)] italic font-mono"
                        >
                          <span className="flex-shrink-0 text-xs mt-0.5">
                            💭
                          </span>
                          <span className="break-all text-[12px]">
                            {log.message}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 py-0.5 font-mono ${
                          log.type === "error"
                            ? "text-red-600"
                            : log.type === "step"
                              ? "text-[var(--workspace_app-text)] font-medium"
                              : log.type === "done"
                                ? (runOutcome === "completed" && log.outcome === "completed" ? "text-green-600 font-medium" : "text-amber-700 font-medium")
                                : log.type === "result"
                                  ? "text-green-600"
                                  : "text-[var(--workspace_app-text-secondary)]"
                        }`}
                      >
                        <span className="flex-shrink-0 mt-0.5 text-xs">
                          {log.type === "status" && "◻"}
                          {log.type === "step" && "▸"}
                          {log.type === "result" && "✓"}
                          {log.type === "error" && "✗"}
                          {log.type === "done" && "●"}
                          {log.type === "session" && "⬡"}
                        </span>
                        <span className="break-all text-[13px]">
                          {log.message}
                        </span>
                      </div>
                    );
                  })}
                  {isRunning && (
                    <div className="flex items-center gap-2 text-[var(--workspace_app-text-secondary)] py-0.5 font-mono">
                      <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      <span className="text-[13px]">Agent is working...</span>
                    </div>
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Table - Workspace App database style */}
        {listings.length > 0 && (
          <div className="border border-[var(--workspace_app-border)] rounded-lg overflow-hidden">
            <div className="bg-[var(--workspace_app-bg-secondary)] px-4 py-2.5 border-b border-[var(--workspace_app-border)] flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="var(--workspace_app-text-secondary)"
              >
                <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h8v2H2v-2z" />
              </svg>
              <span className="text-sm font-medium text-[var(--workspace_app-text)]">
                Zillow Listings
              </span>
              <span className="text-xs text-[var(--workspace_app-text-secondary)] ml-1">
                {listings.length} {runOutcome === "completed" ? "results" : "partial results"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--workspace_app-border)] bg-[var(--workspace_app-bg-secondary)]">
                    <th className="text-left px-4 py-2 font-medium text-[var(--workspace_app-text-secondary)] text-xs uppercase tracking-wide">
                      Address
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-[var(--workspace_app-text-secondary)] text-xs uppercase tracking-wide">
                      Price
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-[var(--workspace_app-text-secondary)] text-xs uppercase tracking-wide">
                      Beds
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-[var(--workspace_app-text-secondary)] text-xs uppercase tracking-wide">
                      Baths
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-[var(--workspace_app-text-secondary)] text-xs uppercase tracking-wide">
                      Sqft
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-[var(--workspace_app-text-secondary)] text-xs uppercase tracking-wide">
                      Details
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-[var(--workspace_app-text-secondary)] text-xs uppercase tracking-wide">
                      Link
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing, i) => (
                    <tr
                      key={i}
                      className="border-b border-[var(--workspace_app-border)] hover:bg-[var(--workspace_app-hover)] transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium text-[var(--workspace_app-text)]">
                        {listing.address}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs font-medium">
                          {listing.price}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--workspace_app-text-secondary)]">
                        {listing.beds}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--workspace_app-text-secondary)]">
                        {listing.baths}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--workspace_app-text-secondary)]">
                        {listing.sqft}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--workspace_app-text-secondary)] max-w-[200px] truncate">
                        {listing.details}
                      </td>
                      <td className="px-4 py-2.5">
                        {listing.link && (
                          <a
                            href={listing.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--workspace_app-blue)] hover:underline text-xs"
                          >
                            View →
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-[var(--workspace_app-text-secondary)]">
          Powered by{" "}
          <a
            href="https://browserbase.com"
            target="_blank"
            className="text-[var(--workspace_app-blue)] hover:underline"
          >
            Browserbase
          </a>{" "}
          +{" "}
          <a
            href="https://docs.stagehand.dev"
            target="_blank"
            className="text-[var(--workspace_app-blue)] hover:underline"
          >
            Stagehand
          </a>
        </div>
      </div>
    </div>
  );
}
