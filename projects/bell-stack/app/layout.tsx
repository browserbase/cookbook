import type { Metadata } from "next";

import "../src/styles.css";

export const metadata: Metadata = {
  title: "Browsie",
  description: "A personal browser assistant built with Eve, Stagehand v4, and Browserbase.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
