import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { useThemeMode } from "@/theme";

export const brandLogoAssets = {
  light: require("../../assets/brand/biz-pro-mark-light.png"),
  dark: require("../../assets/brand/biz-pro-mark-dark.png")
} as const;

export function getBrandLogo(mode: "light" | "dark") {
  return brandLogoAssets[mode];
}

export function BrandLogo({ style, accessibilityLabel = "Biz Pro" }: { style?: StyleProp<ImageStyle>; accessibilityLabel?: string }) {
  const themeMode = useThemeMode();
  return <Image source={getBrandLogo(themeMode)} resizeMode="contain" style={style} accessibilityLabel={accessibilityLabel} />;
}
