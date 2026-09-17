import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Browser task app + Browserbase",
  description: "AI agent that browses the web for you",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
