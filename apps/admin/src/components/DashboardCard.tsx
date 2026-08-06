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
        background: "linear-gradient(180deg, rgba(17,24,39,0.96), rgba(15,23,42,0.94))",
        border: "1px solid var(--border)",
        borderRadius: "24px",
        boxShadow: hovered ? "0 24px 60px rgba(0,0,0,0.42)" : "var(--shadow)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        padding: 22,
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
      <h3 style={{ margin: 0, fontSize: 18, marginBottom: 14, fontFamily: "var(--font-grotesk)", letterSpacing: -0.2 }}>{title}</h3>
      {children}
    </section>
  );
}
