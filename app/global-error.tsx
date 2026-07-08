"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ background: "#0f0f11", color: "#e4e4e7", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 48, margin: "0 0 16px" }}>⚠️</p>
          <h1 style={{ color: "#fff", fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#71717a", fontSize: 14, margin: "0 0 24px" }}>The error has been reported automatically.</p>
          <a href="/" style={{ color: "#f5c842", fontSize: 14 }}>Go back to dashboard →</a>
        </div>
      </body>
    </html>
  );
}
