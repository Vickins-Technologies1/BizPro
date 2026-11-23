"use client";

import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api-proxy/platform-admin/errors/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: error.name || "Admin application error",
        message: error.message || "An admin application error occurred",
        stackTrace: error.stack,
        module: "next-admin",
        source: "admin",
        severity: "high"
      }),
      cache: "no-store"
    }).catch(() => undefined);
  }, [error]);

  return <main className="login-page"><section className="login-card"><div className="eyebrow">DIRA OS · PLATFORM OPERATIONS</div><h1>This page could not load</h1><p>The error will be recorded for review if you are signed in and the API is available.</p><button className="primary-button full-width" onClick={reset}>Try again</button></section></main>;
}
