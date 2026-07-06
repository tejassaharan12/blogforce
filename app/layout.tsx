import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "BlogForce — Pharma Blog Generator",
  description: "AI-powered, compliance-first blog generator for healthcare brands",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink-950 text-zinc-200 antialiased font-sans">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-64 relative">
            <div className="glow-gold absolute inset-x-0 top-0 h-72 pointer-events-none" />
            <div className="relative px-10 py-10 max-w-[1400px]">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
