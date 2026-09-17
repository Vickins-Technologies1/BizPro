"use client";

import React from "react";

export function DashboardCard({
  title,
  children,
  accent
}: {
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <section
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--card-background)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        boxShadow: hovered ? "var(--card-shadow-hover)" : "var(--card-shadow)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        padding: 14,
        position: "relative",
        overflow: "hidden"
      }}
    >
      {accent ? (
        <div
          style={{
            position: "absolute",
            inset: "auto -30px -30px auto",
            width: 140,
            height: 140,
            borderRadius: "999px",
            background: accent,
            filter: "blur(28px)",
            opacity: 0.12,
            pointerEvents: "none"
          }}
        />
      ) : null}
      <h3 style={{ margin: 0, fontSize: 14, marginBottom: 10, fontFamily: "var(--font-grotesk)", letterSpacing: -0.1 }}>{title}</h3>
      {children}
    </section>
  );
}
