import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { setThemeTokens, tokens, type ThemeMode } from "./tokens";

export const appTheme = {
  get tokens() {
    return tokens;
  },
  get colors() {
    return tokens.colors;
  },
  get spacing() {
    return tokens.spacing;
  },
  get radii() {
    return tokens.radii;
  },
  get motion() {
    return tokens.motion;
  },
  get shadow() {
    return tokens.shadow;
  },
  get typography() {
    return tokens.typography;
  }
} as const;

export function useThemeMode() {
  return useAppStore((state) => state.themeMode);
}

export function useThemeTokens() {
  const themeMode = useThemeMode();
  React.useEffect(() => {
    setThemeTokens(themeMode);
  }, [themeMode]);
  return tokens;
}

export type { ThemeMode };
