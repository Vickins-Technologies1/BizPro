import { Appearance } from "react-native";
import { theme as sharedTheme } from "@shared";

export type ThemeMode = "light" | "dark";

type ThemeColors = {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;
  input: string;
  border: string;
  divider: string;
  primary: string;
  primaryStrong: string;
  success: string;
  warning: string;
  danger: string;
  text: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  icon: string;
  disabled: string;
  overlay: string;
};

type ThemeGradients = {
  primary: readonly [string, string];
  surface: readonly [string, string];
  premium: readonly [string, string];
};

type ThemeShadow = {
  card: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  modal: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

export type ThemeTokens = {
  colors: ThemeColors;
  gradients: ThemeGradients;
  shadow: ThemeShadow;
  radii: typeof sharedTheme.radii;
  spacing: typeof sharedTheme.spacing;
  typography: typeof sharedTheme.typography;
  motion: {
    fast: number;
    standard: number;
    slow: number;
    spring: {
      damping: number;
      stiffness: number;
      mass: number;
    };
  };
  font: {
    display: string;
    body: string;
    mono: string;
  };
};

const baseTheme = {
  radii: sharedTheme.radii,
  spacing: sharedTheme.spacing,
  typography: sharedTheme.typography,
  motion: {
    fast: 120,
    standard: 240,
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

const lightTheme: ThemeTokens = {
  ...baseTheme,
  colors: {
    background: "#F8FAFC",
    backgroundAlt: "#F1F7FB",
    surface: "#FFFFFF",
    surfaceAlt: "#F4F8FB",
    surfaceElevated: "#FFFFFF",
    input: "#FFFFFF",
    border: "#D7E3EE",
    divider: "#D7E3EE",
    primary: "#155EEF",
    primaryStrong: "#1245A8",
    success: "#087F5B",
    warning: "#B86A0A",
    danger: "#C53D55",
    text: "#0F172A",
    textPrimary: "#0F172A",
    textSecondary: "#334E68",
    textMuted: "#52637A",
    icon: "#31506D",
    disabled: "#94A3B8",
    overlay: "rgba(15, 23, 42, 0.42)"
  },
  gradients: {
    primary: ["#EAF4FF", "#D9F5F4"],
    surface: ["#FFFFFF", "#F4F8FB"],
    premium: ["rgba(21,94,239,0.14)", "rgba(8,127,91,0.10)"]
  },
  shadow: {
    card: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2
    },
    modal: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.16,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6
    }
  }
};

const darkTheme: ThemeTokens = {
  ...baseTheme,
  colors: {
    background: "#050B16",
    backgroundAlt: "#0A1324",
    surface: "#0E1727",
    surfaceAlt: "#132033",
    surfaceElevated: "#18263B",
    input: "#101A2B",
    border: "#24344D",
    divider: "#24344D",
    primary: "#2E7BFF",
    primaryStrong: "#46B3FF",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#F87171",
    text: "#F8FAFC",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    icon: "#B6C4D6",
    disabled: "#64748B",
    overlay: "rgba(3, 7, 18, 0.74)"
  },
  gradients: {
    primary: ["#2E7BFF", "#1048A5"],
    surface: ["#0E1727", "#050B16"],
    premium: ["rgba(46,123,255,0.24)", "rgba(70,179,255,0.08)"]
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.16,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3
    },
    modal: {
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 9 },
      elevation: 8
    }
  }
};

const themeByMode = {
  light: lightTheme,
  dark: darkTheme
} as const;

export function resolvePreferredThemeMode(): ThemeMode {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export const initialThemeMode = resolvePreferredThemeMode();
export const lightTokens = lightTheme;
export const darkTokens = darkTheme;

export let tokens: ThemeTokens = themeByMode[initialThemeMode];

export function getThemeTokens(mode: ThemeMode) {
  return themeByMode[mode];
}

export function setThemeTokens(mode: ThemeMode) {
  tokens = themeByMode[mode];
}
