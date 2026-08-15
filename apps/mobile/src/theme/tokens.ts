import { theme as sharedTheme } from "@shared";

export type ThemeMode = "light" | "dark";

const baseTheme = {
  radii: sharedTheme.radii,
  spacing: sharedTheme.spacing,
  typography: sharedTheme.typography,
  motion: {
    fast: 140,
    standard: 220,
    slow: 320,
    spring: {
      damping: 18,
      stiffness: 180,
      mass: 0.9
    }
  },
  font: {
    display: "System",
    body: "System",
    mono: "System"
  }
} as const;

const lightTheme = {
  ...baseTheme,
  colors: {
    background: "#F8FAFC",
    backgroundAlt: "#E2E8F0",
    surface: "#FFFFFF",
    surfaceAlt: "#F1F5F9",
    border: "#CBD5E1",
    primary: "#2563EB",
    primaryStrong: "#1D4ED8",
    success: "#059669",
    warning: "#D97706",
    danger: "#DC2626",
    text: "#0F172A",
    textSecondary: "#334155",
    textMuted: "#64748B",
    overlay: "rgba(15, 23, 42, 0.52)"
  },
  gradients: {
    primary: ["#EFF6FF", "#DBEAFE"] as const,
    surface: ["#FFFFFF", "#EEF2FF"] as const,
    premium: ["rgba(37,99,235,0.16)", "rgba(16,185,129,0.10)"] as const
  },
  shadow: {
    card: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6
    },
    modal: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.18,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 10
    }
  }
} as const;

const darkTheme = {
  ...baseTheme,
  colors: {
    background: "#0B1220",
    backgroundAlt: "#0F172A",
    surface: "#111827",
    surfaceAlt: "#1A2436",
    border: "#243041",
    primary: "#2563EB",
    primaryStrong: "#3B82F6",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    text: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    overlay: "rgba(3, 7, 18, 0.72)"
  },
  gradients: {
    primary: ["#2563EB", "#1E40AF"] as const,
    surface: ["#111827", "#0B1220"] as const,
    premium: ["rgba(37,99,235,0.35)", "rgba(16,185,129,0.15)"] as const
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10
    },
    modal: {
      shadowColor: "#000",
      shadowOpacity: 0.42,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 16 },
      elevation: 14
    }
  }
} as const;

export const lightTokens = lightTheme;
export const darkTokens = darkTheme;

export type ThemeTokens = typeof lightTheme | typeof darkTheme;

export let tokens: ThemeTokens = lightTokens;

export function setThemeTokens(mode: ThemeMode) {
  tokens = mode === "dark" ? darkTokens : lightTokens;
}
