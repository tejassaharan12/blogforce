"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 relative">
        <div className="glow-gold absolute inset-x-0 top-0 h-72 pointer-events-none" />
        <div className="relative px-10 py-10 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
