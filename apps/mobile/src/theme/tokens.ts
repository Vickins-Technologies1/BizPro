import { Appearance } from "react-native";
import { theme as sharedTheme } from "@shared";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

type ThemeColors = {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceAlt: string;
  surfaceCard: string;
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
    background: "#F5F7FA",
    backgroundAlt: "#EEF2F6",
    surface: "#FFFFFF",
    surfaceAlt: "#F7F8FA",
    surfaceCard: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    input: "#FFFFFF",
    border: "#E1E7EF",
    divider: "#E1E7EF",
    primary: "#155EEF",
    primaryStrong: "#155EEF",
    success: "#079455",
    warning: "#DC6803",
    danger: "#D92D20",
    text: "#111827",
    textPrimary: "#111827",
    textSecondary: "#596579",
    textMuted: "#98A2B3",
    icon: "#667085",
    disabled: "#94A3B8",
    overlay: "rgba(15, 23, 42, 0.42)"
  },
  gradients: {
    primary: ["#155EEF", "#155EEF"],
    surface: ["#FFFFFF", "#F5F7FA"],
    premium: ["rgba(21,94,239,0.035)", "rgba(21,94,239,0.005)"]
  },
  shadow: {
    card: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.035,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1
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
    background: "#08111F",
    backgroundAlt: "#0D1929",
    surface: "#0D1929",
    surfaceAlt: "#132238",
    surfaceCard: "#102035",
    surfaceElevated: "#172943",
    input: "#0C1A2D",
    border: "#223A57",
    divider: "#223A57",
    primary: "#3B82F6",
    primaryStrong: "#3B82F6",
    success: "#32D583",
    warning: "#FDB022",
    danger: "#F97066",
    text: "#F5F7FA",
    textPrimary: "#F5F7FA",
    textSecondary: "#A9B8CA",
    textMuted: "#737D8C",
    icon: "#A8B0BC",
    disabled: "#505966",
    overlay: "rgba(0, 0, 0, 0.55)"
  },
  gradients: {
    primary: ["#3B82F6", "#2563EB"],
    surface: ["#11161D", "#0B0F14"],
    premium: ["rgba(59,130,246,0.07)", "rgba(59,130,246,0.01)"]
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2
    },
    modal: {
      shadowColor: "#000",
      shadowOpacity: 0.34,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 10 },
      elevation: 7
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

export function resolveThemeMode(preference: ThemePreference): ThemeMode {
  return preference === "system" ? resolvePreferredThemeMode() : preference;
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
