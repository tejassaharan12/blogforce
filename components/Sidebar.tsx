"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, PenLine, BookOpen, BarChart2, LogOut } from "lucide-react";
import clsx from "clsx";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate", label: "Generate Blog", icon: PenLine },
  { href: "/blogs", label: "All Blogs", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-ink-900/80 backdrop-blur-xl border-r border-white/[0.06] flex flex-col z-20">
      <div className="px-5 py-6 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <Image
            src="/sd-icon.png"
            alt="Story Digital"
            width={36}
            height={36}
            className="rounded-xl flex-shrink-0"
          />
          <div>
            <span className="text-base font-display font-semibold tracking-tight text-white block leading-tight">
              BlogForce
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 leading-none">
              Story Digital
            </span>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              path === href
                ? "bg-gold-400/10 text-gold-300 border border-gold-400/20 shadow-glow-gold"
                : "text-zinc-400 border border-transparent hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <Icon
              className={clsx(
                "w-4 h-4 transition-colors",
                path === href ? "text-gold-400" : "text-zinc-500 group-hover:text-zinc-300"
              )}
            />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-white/[0.06] space-y-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.06] border border-transparent transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
        <p className="text-[11px] text-zinc-600 px-3">
          Story Digital · Agency Tool
        </p>
      </div>
    </aside>
  );
}
