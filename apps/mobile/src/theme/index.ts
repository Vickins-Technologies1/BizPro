import { tokens } from "./tokens";

export const appTheme = {
  tokens,
  colors: tokens.colors,
  spacing: tokens.spacing,
  radii: tokens.radii,
  typography: tokens.typography
} as const;
