import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "@/theme/tokens";

export function Screen({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function GradientHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <LinearGradient colors={tokens.gradients.surface} style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </LinearGradient>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatCard({ label, value, hint, icon, tone = "primary" }: { label: string; value: string; hint?: string; icon: keyof typeof Ionicons.glyphMap; tone?: "primary" | "success" | "warning" | "danger" }) {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.iconWrap, { backgroundColor: toneColor(tone, 0.16) }]}>
        <Ionicons name={icon} size={18} color={toneColor(tone, 1)} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </Card>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  variant = "primary"
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, buttonStyle(variant), pressed && { opacity: 0.85 }]}>
      {loading ? <ActivityIndicator color={tokens.colors.text} /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = "default"
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

export function Badge({ label, tone = "primary" }: { label: string; tone?: "primary" | "success" | "warning" | "danger" }) {
  return <View style={[styles.badge, { backgroundColor: toneColor(tone, 0.16) }]}><Text style={[styles.badgeText, { color: toneColor(tone, 1) }]}>{label}</Text></View>;
}

export function EmptyState({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </Card>
  );
}

export function SimpleModal({
  visible,
  title,
  children,
  onClose
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={tokens.colors.textSecondary} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function toneColor(tone: "primary" | "success" | "warning" | "danger", alpha = 1) {
  const base =
    tone === "success"
      ? tokens.colors.success
      : tone === "warning"
        ? tokens.colors.warning
        : tone === "danger"
          ? tokens.colors.danger
          : tokens.colors.primary;
  return withAlpha(base, alpha);
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const parsed = Number.parseInt(value, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buttonStyle(variant: "primary" | "secondary" | "danger") {
  if (variant === "secondary") return { backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border };
  if (variant === "danger") return { backgroundColor: tokens.colors.danger };
  return { backgroundColor: tokens.colors.primary };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    paddingTop: 14
  },
  header: {
    marginHorizontal: 16,
    padding: 18,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  title: { color: tokens.colors.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: tokens.colors.textSecondary, marginTop: 4, fontSize: 13 },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    ...tokens.shadow.card
  },
  statCard: { gap: 8, minHeight: 126 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  statLabel: { color: tokens.colors.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  statValue: { color: tokens.colors.text, fontSize: 22, fontWeight: "800" },
  statHint: { color: tokens.colors.textSecondary, fontSize: 12 },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  buttonText: { color: tokens.colors.text, fontSize: 15, fontWeight: "700" },
  fieldLabel: { color: tokens.colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 16,
    color: tokens.colors.text,
    fontSize: 15
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start"
  },
  badgeText: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  empty: { alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { color: tokens.colors.text, fontSize: 18, fontWeight: "800" },
  emptySubtitle: { color: tokens.colors.textSecondary, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: tokens.colors.overlay,
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 16
  },
  modalCard: {
    width: "100%",
    backgroundColor: tokens.colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16
  },
  modalTitle: { color: tokens.colors.text, fontSize: 18, fontWeight: "800" }
});
