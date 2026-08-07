import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppStore } from "@/store/useAppStore";
import { tokens } from "@/theme/tokens";
import { addMonths, eachDayOfInterval, endOfMonth, format, isAfter, isBefore, isSameDay, isSameMonth, parseISO, startOfMonth, subMonths } from "date-fns";

export function Screen({ children, hideFooter = true }: { children: React.ReactNode; hideFooter?: boolean }) {
  const styles = usePrimitiveStyles();
  useAppStore((state) => state.themeMode);
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
        {children}
        {hideFooter ? null : <AppFooter />}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export function AppScrollView({
  children,
  contentContainerStyle,
  refreshing,
  onRefresh,
  scrollRef,
  ...props
}: React.ComponentProps<typeof ScrollView> & {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollRef?: React.RefObject<ScrollView>;
}) {
  const styles = usePrimitiveStyles();
  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={tokens.colors.primaryStrong} colors={[tokens.colors.primaryStrong]} />
        ) : undefined
      }
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function AppFooter() {
  const styles = usePrimitiveStyles();
  return (
    <View style={styles.footer}>
      <View style={styles.footerDivider} />
      <Text style={styles.footerText}>Powered by Vickins Technologies</Text>
    </View>
  );
}

export function SkeletonBlock({ width = "100%", height = 16, radius = 12, style }: { width?: number | string; height?: number; radius?: number; style?: any }) {
  const styles = usePrimitiveStyles();
  return <View style={[styles.skeleton, { width, height, borderRadius: radius }, style]} />;
}

export function GradientHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const styles = usePrimitiveStyles();
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

export function DateRangePickerModal({
  visible,
  title,
  startDate,
  endDate,
  onClose,
  onApply
}: {
  visible: boolean;
  title: string;
  startDate: string | null;
  endDate: string | null;
  onClose: () => void;
  onApply: (range: { startDate: string; endDate: string }) => void;
}) {
  const styles = usePrimitiveStyles();
  const today = React.useMemo(() => new Date(), []);
  const initialCursor = React.useMemo(() => parsePickerDate(startDate ?? endDate ?? format(today, "yyyy-MM-dd")) ?? today, [endDate, startDate, today]);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [selection, setSelection] = React.useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

  React.useEffect(() => {
    if (!visible) return;
    const start = parsePickerDate(startDate);
    const end = parsePickerDate(endDate);
    setCursor(parsePickerDate(startDate ?? endDate ?? format(today, "yyyy-MM-dd")) ?? today);
    setSelection({ start, end });
  }, [endDate, startDate, today, visible]);

  const monthLabel = format(cursor, "MMMM yyyy");
  const days = React.useMemo(() => buildCalendarDays(cursor), [cursor]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { padding: 16 }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.helperText}>Select a start and end date, then apply the range.</Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={tokens.colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.calendarShell}>
            <View style={styles.calendarTopRow}>
              <Pressable onPress={() => setCursor((current) => subMonths(current, 1))} style={styles.calendarNavButton}>
                <Ionicons name="chevron-back" size={20} color={tokens.colors.text} />
              </Pressable>
              <Text style={styles.calendarMonth}>{monthLabel}</Text>
              <Pressable onPress={() => setCursor((current) => addMonths(current, 1))} style={styles.calendarNavButton}>
                <Ionicons name="chevron-forward" size={20} color={tokens.colors.text} />
              </Pressable>
            </View>

            <View style={styles.calendarWeekRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((label) => (
                <Text key={label} style={styles.calendarWeekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {days.map((day, index) =>
                day ? (
                  <Pressable
                    key={format(day, "yyyy-MM-dd")}
                    onPress={() => {
                      setSelection((current) => selectRangeDay(current, day));
                    }}
                    style={({ pressed }) => [
                      styles.calendarDayButton,
                      isCalendarSelected(day, selection) ? styles.calendarDayButtonSelected : null,
                      !isSameMonth(day, cursor) ? styles.calendarDayButtonMuted : null,
                      pressed && { opacity: 0.9 }
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        isCalendarSelected(day, selection) ? styles.calendarDayTextSelected : null,
                        !isSameMonth(day, cursor) ? styles.calendarDayTextMuted : null
                      ]}
                    >
                      {format(day, "d")}
                    </Text>
                  </Pressable>
                ) : (
                  <View key={`blank-${index}`} style={styles.calendarDaySpacer} />
                )
              )}
            </View>
          </View>

          <View style={styles.calendarSummary}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.fieldLabel}>Start</Text>
              <Text style={styles.calendarSummaryValue}>{selection.start ? format(selection.start, "PPP") : "Choose a start date"}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.fieldLabel}>End</Text>
              <Text style={styles.calendarSummaryValue}>{selection.end ? format(selection.end, "PPP") : "Choose an end date"}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <PrimaryButton
              title="Reset"
              variant="secondary"
              onPress={() => {
                const current = new Date();
                setCursor(current);
                setSelection({ start: null, end: null });
              }}
            />
            <PrimaryButton
              title="Apply"
              onPress={() => {
                const start = selection.start ?? startOfMonth(cursor);
                const end = selection.end ?? selection.start ?? endOfMonth(cursor);
                onApply({ startDate: format(start, "yyyy-MM-dd"), endDate: format(end, "yyyy-MM-dd") });
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const styles = usePrimitiveStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "primary"
}: {
  label: string;
  value: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const styles = usePrimitiveStyles();
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
  variant = "primary",
  disabled = false
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const styles = usePrimitiveStyles();
  const isDisabled = loading || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.button,
        buttonStyle(variant),
        isDisabled && { opacity: 0.7 },
        pressed && !isDisabled && { opacity: 0.9, transform: [{ scale: 0.985 }] }
      ]}
    >
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
  keyboardType = "default",
  helperText,
  error
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  helperText?: string;
  error?: string | null | undefined;
}) {
  const inputRef = React.useRef<React.ElementRef<typeof TextInput>>(null);
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const styles = usePrimitiveStyles();
  const isSecureEntry = secureTextEntry ? !passwordVisible : false;

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.fieldLabelRow}>
        <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="button">
          <Text style={styles.fieldLabel}>{label}</Text>
        </Pressable>
        {secureTextEntry ? (
          <Pressable
            onPress={() => setPasswordVisible((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? `Hide ${label}` : `Show ${label}`}
            style={styles.passwordToggle}
          >
            <Ionicons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={16} color={tokens.colors.primaryStrong} />
            <Text style={styles.passwordToggleText}>{passwordVisible ? "Hide" : "View"}</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.colors.textMuted}
        secureTextEntry={isSecureEntry}
        keyboardType={keyboardType}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.helperError}>{error}</Text> : helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = "primary" }: { label: string; tone?: "primary" | "success" | "warning" | "danger" }) {
  const styles = usePrimitiveStyles();
  return (
    <View style={[styles.badge, { backgroundColor: toneColor(tone, 0.16) }]}>
      <Text style={[styles.badgeText, { color: toneColor(tone, 1) }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
  icon
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const styles = usePrimitiveStyles();
  return (
    <Card style={styles.empty}>
      {icon ? (
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={28} color={tokens.colors.primaryStrong} />
        </View>
      ) : null}
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
  const styles = usePrimitiveStyles();
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

function usePrimitiveStyles() {
  return React.useMemo(() => createStyles(), [tokens]);
}

function parsePickerDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildCalendarDays(cursor: Date) {
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const firstDay = start.getDay();
  const padding: Array<Date | null> = Array.from({ length: firstDay }, () => null);
  return padding.concat(eachDayOfInterval({ start, end }));
}

function selectRangeDay(current: { start: Date | null; end: Date | null }, day: Date) {
  if (!current.start || current.end) {
    return { start: day, end: null };
  }
  if (isBefore(day, current.start)) {
    return { start: day, end: current.start };
  }
  if (isSameDay(day, current.start)) {
    return { start: current.start, end: current.start };
  }
  return { start: current.start, end: day };
}

function isCalendarSelected(day: Date, selection: { start: Date | null; end: Date | null }) {
  if (!selection.start) return false;
  if (!selection.end) return isSameDay(day, selection.start);
  return (isSameDay(day, selection.start) || isSameDay(day, selection.end) || (isAfter(day, selection.start) && isBefore(day, selection.end)));
}

function createStyles() {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: tokens.colors.background,
      paddingTop: 10
    },
    header: {
      marginHorizontal: 16,
      padding: 16,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12
    },
    title: { color: tokens.colors.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
    subtitle: { color: tokens.colors.textSecondary, marginTop: 5, fontSize: 12, lineHeight: 17 },
    card: {
      backgroundColor: tokens.colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      padding: 14,
      ...tokens.shadow.card
    },
    statCard: { gap: 6, minHeight: 120 },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center"
    },
    statLabel: { color: tokens.colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 },
    statValue: { color: tokens.colors.text, fontSize: 19, fontWeight: "800" },
    statHint: { color: tokens.colors.textSecondary, fontSize: 12 },
    button: {
      minHeight: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16
    },
    buttonText: { color: tokens.colors.text, fontSize: 14, fontWeight: "700" },
    fieldLabel: { color: tokens.colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.55 },
    fieldLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    },
    passwordToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 3,
      paddingHorizontal: 6
    },
    passwordToggleText: {
      color: tokens.colors.primaryStrong,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.4
    },
    input: {
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: tokens.colors.surface,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      paddingHorizontal: 14,
      color: tokens.colors.text,
      fontSize: 14
    },
    inputError: {
      borderColor: tokens.colors.danger,
      backgroundColor: withAlpha(tokens.colors.danger, 0.06)
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignSelf: "flex-start"
    },
    badgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.35 },
    empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14 },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(tokens.colors.primary, 0.1)
    },
    emptyTitle: { color: tokens.colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
    emptySubtitle: { color: tokens.colors.textSecondary, textAlign: "center", lineHeight: 20 },
    helperText: { color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 },
    helperError: { color: tokens.colors.danger, fontSize: 12, lineHeight: 17, fontWeight: "700" },
    modalOverlay: {
      flex: 1,
      backgroundColor: tokens.colors.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 16
    },
    modalCard: {
      width: "100%",
      maxHeight: "92%",
      backgroundColor: tokens.colors.surface,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      padding: 18
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14
    },
    modalTitle: { color: tokens.colors.text, fontSize: 16, fontWeight: "800" },
    calendarShell: {
      backgroundColor: tokens.colors.surfaceAlt,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      padding: 12,
      gap: 12
    },
    calendarTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10
    },
    calendarNavButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tokens.colors.surface,
      borderWidth: 1,
      borderColor: tokens.colors.border
    },
    calendarMonth: {
      color: tokens.colors.text,
      fontSize: 15,
      fontWeight: "800"
    },
    calendarWeekRow: {
      flexDirection: "row",
      justifyContent: "space-between"
    },
    calendarWeekLabel: {
      color: tokens.colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      width: 38,
      textAlign: "center"
    },
    calendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 8,
      columnGap: 8
    },
    calendarDayButton: {
      width: 36,
      height: 36,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tokens.colors.surface
    },
    calendarDayButtonSelected: {
      backgroundColor: tokens.colors.primary
    },
    calendarDayButtonMuted: {
      opacity: 0.38
    },
    calendarDayText: {
      color: tokens.colors.text,
      fontSize: 13,
      fontWeight: "700"
    },
    calendarDayTextSelected: {
      color: "#FFFFFF"
    },
    calendarDayTextMuted: {
      color: tokens.colors.textMuted
    },
    calendarDaySpacer: {
      width: 36,
      height: 36
    },
    calendarSummary: {
      flexDirection: "row",
      gap: 12
    },
    calendarSummaryValue: {
      color: tokens.colors.text,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18
    },
    scrollContent: {
      padding: 14,
      gap: 14,
      paddingBottom: 24
    },
    skeleton: {
      backgroundColor: withAlpha(tokens.colors.textMuted, 0.14)
    },
    footer: {
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 10
    },
    footerDivider: {
      width: "100%",
      height: StyleSheet.hairlineWidth,
      backgroundColor: tokens.colors.border,
      marginBottom: 12
    },
    footerText: {
      color: tokens.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.5,
      textAlign: "center"
    }
  });
}
