import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppScrollView, Card, Screen } from "@/components/Primitives";
import { BrandLogo } from "@/components/BrandLogo";
import { useThemeTokens } from "@/theme";

export function AuthLayout({
  title,
  subtitle,
  eyebrow = "Workspace access",
  children,
  footer
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const theme = useThemeTokens();

  return (
    <Screen hideFooter>
      <AppScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.shell}>
          <AuthCompactHeader eyebrow={eyebrow} />

          <View style={styles.heading}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
          </View>

          <Card style={[styles.card, { backgroundColor: theme.colors.surfaceElevated }]}>{children}</Card>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </AppScrollView>
    </Screen>
  );
}

export function AuthCompactHeader({ eyebrow = "Workspace access" }: { eyebrow?: string }) {
  const theme = useThemeTokens();
  return (
    <LinearGradient colors={theme.gradients.surface} style={styles.brandPanel}>
      <View style={[styles.logoTile, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
        <BrandLogo style={styles.logo} />
      </View>
      <View style={styles.brandCopy}>
        <Text style={[styles.brandName, { color: theme.colors.text }]}>Dira OS</Text>
        <Text style={[styles.eyebrow, { color: theme.colors.primaryStrong }]}>{eyebrow}</Text>
      </View>
    </LinearGradient>
  );
}

export function AuthMessage({ tone, icon, children }: { tone: "error" | "success" | "info"; icon?: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const theme = useThemeTokens();
  const color = tone === "error" ? theme.colors.danger : tone === "success" ? theme.colors.success : theme.colors.primaryStrong;
  const background = tone === "error" ? `${theme.colors.danger}14` : tone === "success" ? `${theme.colors.success}14` : `${theme.colors.primary}12`;

  return (
    <View style={[styles.message, { borderColor: `${color}40`, backgroundColor: background }]} accessibilityRole={tone === "error" ? "alert" : "text"}>
      <Ionicons name={icon ?? (tone === "error" ? "alert-circle-outline" : tone === "success" ? "checkmark-circle-outline" : "information-circle-outline")} size={17} color={color} />
      <Text style={[styles.messageText, { color: theme.colors.text }]}>{children}</Text>
    </View>
  );
}

export function AuthLink({ label, onPress, icon = "arrow-forward-outline" }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const theme = useThemeTokens();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={({ pressed }) => [styles.link, pressed && { opacity: 0.72 }]}>
      <Text style={[styles.linkText, { color: theme.colors.primaryStrong }]}>{label}</Text>
      <Ionicons name={icon} size={15} color={theme.colors.primaryStrong} />
    </Pressable>
  );
}

export function AuthSectionLabel({ children }: { children: React.ReactNode }) {
  const theme = useThemeTokens();
  return <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22
  },
  shell: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    gap: 14,
    justifyContent: "center",
    flexGrow: 1
  },
  brandPanel: {
    minHeight: 68,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent"
  },
  logoTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  logo: { width: 38, height: 38 },
  brandCopy: { gap: 2 },
  brandName: { fontSize: 15, fontWeight: "900", letterSpacing: -0.25 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 0.65, textTransform: "uppercase" },
  heading: { gap: 5, paddingHorizontal: 2 },
  title: { fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.7 },
  subtitle: { fontSize: 13, lineHeight: 19, maxWidth: 380 },
  card: { gap: 13, padding: 16, borderRadius: 20 },
  footer: { alignItems: "center", minHeight: 24 },
  sectionLabel: { fontSize: 10, lineHeight: 15, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  message: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  messageText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  link: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 4 },
  linkText: { fontSize: 12, lineHeight: 18, fontWeight: "800" }
});
