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
  return (
    <section
      style={{
        background: "linear-gradient(180deg, rgba(17,24,39,0.96), rgba(15,23,42,0.96))",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        padding: 20,
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
      <h3 style={{ margin: 0, fontSize: 18, marginBottom: 12, fontFamily: "var(--font-grotesk)" }}>{title}</h3>
      {children}
    </section>
  );
}
