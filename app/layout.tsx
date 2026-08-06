import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaptra — captions for Shorts, burned in automatically",
  description:
    "Add styled captions to a YouTube Short and post it. Synced automatically, with the words that matter highlighted for you.",
};

export const viewport: Viewport = {
  themeColor: "#08080b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-chalk antialiased">{children}</body>
    </html>
  );
}
