"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const from = params.get("from") || "/";
      router.push(from);
      router.refresh();
    } else {
      setError("Incorrect password. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b0c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <Image src="/sd-icon.png" alt="Story Digital" width={40} height={40} className="rounded-xl" />
          <div>
            <span className="text-xl font-semibold text-white tracking-tight block leading-tight">BlogForce</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Story Digital</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/60 border border-white/[0.07] rounded-2xl p-8 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-gold-400" />
            <h1 className="text-white font-semibold text-base">Sign in to continue</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-zinc-800/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-gold-400/50 focus:ring-1 focus:ring-gold-400/20 transition pr-10"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gold-400 hover:bg-gold-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-xl py-2.5 text-sm transition-all duration-200"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-zinc-600 text-xs mt-6">
          Internal tool · Story Digital Agency
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
