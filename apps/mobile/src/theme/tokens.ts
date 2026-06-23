import { theme as sharedTheme } from "@shared";

export const tokens = {
  ...sharedTheme,
  gradients: {
    primary: ["#2563EB", "#1E40AF"] as const,
    surface: ["#111827", "#0B1220"] as const,
    premium: ["rgba(37,99,235,0.35)", "rgba(16,185,129,0.15)"] as const
  },
  font: {
    display: "System",
    body: "System",
    mono: "System"
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10
    }
  }
} as const;
