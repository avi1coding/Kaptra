import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = {
  title: "Studio — Kaptra",
  description:
    "Upload a Short, tune the caption style, preview it live and export a burned-in MP4.",
};

export default function StudioPage() {
  return (
    <div className="min-h-screen">
      <Nav variant="app" />
      <Studio />
    </div>
  );
}
