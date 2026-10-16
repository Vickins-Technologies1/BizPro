import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { useThemeMode } from "@/theme";

export const brandLogoAssets = {
  // Use the opaque, tightly-cropped mark for in-app rendering. The original
  // transparent logo can be decoded as an empty image by some Android builds.
  light: require("../../assets/brand/dira-os-mobile-icon.png"),
  dark: require("../../assets/brand/dira-os-mobile-icon.png")
} as const;

export function getBrandLogo(mode: "light" | "dark") {
  return brandLogoAssets[mode];
}

export function BrandLogo({ style, accessibilityLabel = "Dira OS" }: { style?: StyleProp<ImageStyle>; accessibilityLabel?: string }) {
  const themeMode = useThemeMode();
  return <Image source={getBrandLogo(themeMode)} resizeMode="contain" style={style} accessibilityLabel={accessibilityLabel} />;
}
