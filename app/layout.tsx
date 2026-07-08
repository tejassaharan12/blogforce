import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "BlogForce — Pharma Blog Generator",
  description: "AI-powered, compliance-first blog generator for healthcare brands",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink-950 text-zinc-200 antialiased font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
