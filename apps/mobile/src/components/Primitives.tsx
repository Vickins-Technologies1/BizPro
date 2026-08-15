import React from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Image,
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
import { Swipeable } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppStore } from "@/store/useAppStore";
import { tokens } from "@/theme/tokens";
import { addMonths, eachDayOfInterval, endOfMonth, format, isAfter, isBefore, isSameDay, isSameMonth, parseISO, startOfMonth, subMonths } from "date-fns";
import type { FlatListProps, ImageSourcePropType, StyleProp, TextStyle, ViewStyle } from "react-native";

export const designTokens = {
  get colors() {
    return tokens.colors;
  },
  get spacing() {
    return tokens.spacing;
  },
  get radii() {
    return tokens.radii;
  },
  get typography() {
    return tokens.typography;
  },
  get shadows() {
    return tokens.shadow;
  },
  motion: {
    fast: tokens.motion.fast,
    standard: tokens.motion.standard,
    slow: tokens.motion.slow
  }
} as const;

function useAppearMotion(delay = 0, from = 12) {
  const animated = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.timing(animated, {
      toValue: 1,
      delay,
      duration: designTokens.motion.standard,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });
    animation.start();
    return () => {
      animated.stopAnimation();
    };
  }, [animated, delay]);

  return {
    opacity: animated,
    transform: [
      {
        translateY: animated.interpolate({
          inputRange: [0, 1],
          outputRange: [from, 0]
        })
      },
      {
        scale: animated.interpolate({
          inputRange: [0, 1],
          outputRange: [0.992, 1]
        })
      }
    ]
  } as any;
}

export function Screen({ children, hideFooter = true }: { children: React.ReactNode; hideFooter?: boolean }) {
  const styles = usePrimitiveStyles();
  useAppStore((state) => state.themeMode);
  const motion = useAppearMotion();
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
        <View pointerEvents="none" style={styles.screenBackdrop}>
          <LinearGradient colors={tokens.gradients.surface} style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={tokens.gradients.premium} style={styles.screenGlowPrimary} />
          <View style={styles.screenGlowSecondary} />
        </View>
    <Animated.View style={[styles.screenContent, motion as any]}>{children}</Animated.View>
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
      showsVerticalScrollIndicator={false}
      overScrollMode="always"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primaryStrong}
            colors={[tokens.colors.primaryStrong]}
            progressBackgroundColor={tokens.colors.surface}
          />
        ) : undefined
      }
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

type AppVirtualizedListProps<T> = Omit<FlatListProps<T>, "contentContainerStyle" | "refreshControl"> & {
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function AppVirtualizedList<T>({
  contentContainerStyle,
  refreshing,
  onRefresh,
  ...props
}: AppVirtualizedListProps<T>) {
  const styles = usePrimitiveStyles();
  return (
    <FlatList
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primaryStrong}
            colors={[tokens.colors.primaryStrong]}
            progressBackgroundColor={tokens.colors.surface}
          />
        ) : undefined
      }
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      {...props}
    />
  );
}

export function AppFooter() {
  const styles = usePrimitiveStyles();
  return (
    <View style={styles.footer}>
      <View style={styles.footerDivider} />
      <Text style={styles.footerText}>Built for fast-moving teams</Text>
    </View>
  );
}

export function SkeletonBlock({
  width = "100%",
  height = 16,
  radius = 12,
  style
}: {
  width?: number | `${number}%` | "auto" | undefined;
  height?: number | undefined;
  radius?: number | undefined;
  style?: any;
}) {
  return <Skeleton width={width} height={height} radius={radius} style={style} />;
}

export function GradientHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const styles = usePrimitiveStyles();
  return (
    <LinearGradient colors={tokens.gradients.surface} style={styles.header}>
      <View style={styles.headerPill}>
        <Ionicons name="sparkles-outline" size={12} color={tokens.colors.primaryStrong} />
        <Text style={styles.headerPillText}>Biz Pro</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
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
  const motion = useAppearMotion(0, 10);
  return (
    <Animated.View style={[styles.card, motion, style]}>
      {children}
    </Animated.View>
  );
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
  hint?: string | undefined;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const styles = usePrimitiveStyles();
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statAccentBar, { backgroundColor: toneColor(tone, 1) }]} />
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
  return <Button title={title} onPress={onPress} loading={loading} variant={variant} disabled={disabled} />;
}

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = "default",
  helperText,
  error,
  multiline = false,
  numberOfLines,
  rightAccessory,
  leftAccessory,
  autoCapitalize = "none",
  autoCorrect = false,
  onSubmitEditing,
  returnKeyType,
  autoFocus = false
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  helperText?: string;
  error?: string | null | undefined;
  multiline?: boolean;
  numberOfLines?: number;
  rightAccessory?: React.ReactNode;
  leftAccessory?: React.ReactNode;
  autoCapitalize?: React.ComponentProps<typeof TextInput>["autoCapitalize"];
  autoCorrect?: boolean;
  onSubmitEditing?: React.ComponentProps<typeof TextInput>["onSubmitEditing"];
  returnKeyType?: React.ComponentProps<typeof TextInput>["returnKeyType"];
  autoFocus?: boolean;
}) {
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      helperText={helperText}
      error={error}
      multiline={multiline}
      numberOfLines={numberOfLines}
      rightAccessory={rightAccessory}
      leftAccessory={leftAccessory}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      onSubmitEditing={onSubmitEditing}
      returnKeyType={returnKeyType}
      autoFocus={autoFocus}
    />
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
      <View style={styles.emptyBadge}>
        <Text style={styles.emptyBadgeText}>Biz Pro</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </Card>
  );
}

export function SuccessState({
  title,
  subtitle,
  action,
  icon = "checkmark-circle-outline"
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const styles = usePrimitiveStyles();
  return (
    <Card style={{ alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20 }}>
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(tokens.colors.success, 0.14),
          borderWidth: 1,
          borderColor: withAlpha(tokens.colors.success, 0.28)
        }}
      >
        <Ionicons name={icon} size={30} color={tokens.colors.success} />
      </View>
      <View style={styles.successBadge}>
        <Text style={styles.successBadgeText}>Completed</Text>
      </View>
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
  return <Dialog visible={visible} title={title} onClose={onClose}>{children}</Dialog>;
}

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  label,
  title,
  onPress,
  loading,
  variant = "primary",
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  style,
  textStyle
}: {
  label?: string;
  title?: string;
  onPress?: (() => void) | undefined;
  loading?: boolean | undefined;
  variant?: ButtonVariant | undefined;
  disabled?: boolean | undefined;
  iconLeft?: keyof typeof Ionicons.glyphMap | undefined;
  iconRight?: keyof typeof Ionicons.glyphMap | undefined;
  fullWidth?: boolean | undefined;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const styles = usePrimitiveStyles();
  const isDisabled = loading || disabled;
  const resolvedLabel = label ?? title ?? "";
  const filled = variant === "primary" || variant === "danger";
  const textColor = filled ? "#FFFFFF" : variant === "secondary" ? tokens.colors.text : tokens.colors.primaryStrong;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.button,
        buttonStyle(variant),
        fullWidth && { alignSelf: "stretch" },
        style,
        isDisabled && { opacity: 0.72 },
        pressed && !isDisabled && { opacity: 0.92, transform: [{ scale: 0.985 }] }
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {iconLeft ? <Ionicons name={iconLeft} size={16} color={textColor} /> : null}
          <Text style={[styles.buttonText, { color: textColor }, textStyle]}>{resolvedLabel}</Text>
          {iconRight ? <Ionicons name={iconRight} size={16} color={textColor} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = "default",
  helperText,
  error,
  multiline = false,
  numberOfLines,
  rightAccessory,
  leftAccessory,
  autoCapitalize = "none",
  autoCorrect = false,
  onSubmitEditing,
  returnKeyType,
  autoFocus = false
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string | undefined;
  secureTextEntry?: boolean | undefined;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"] | undefined;
  helperText?: string | undefined;
  error?: string | null | undefined;
  multiline?: boolean | undefined;
  numberOfLines?: number | undefined;
  rightAccessory?: React.ReactNode | undefined;
  leftAccessory?: React.ReactNode | undefined;
  autoCapitalize?: React.ComponentProps<typeof TextInput>["autoCapitalize"] | undefined;
  autoCorrect?: boolean | undefined;
  onSubmitEditing?: React.ComponentProps<typeof TextInput>["onSubmitEditing"] | undefined;
  returnKeyType?: React.ComponentProps<typeof TextInput>["returnKeyType"] | undefined;
  autoFocus?: boolean | undefined;
}) {
  const inputRef = React.useRef<React.ElementRef<typeof TextInput>>(null);
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const styles = usePrimitiveStyles();
  const isSecureEntry = secureTextEntry ? !passwordVisible : false;

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.fieldLabelRow}>
        <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="button">
          <Text style={styles.fieldLabel}>{label}</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {rightAccessory}
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
      </View>
      <View style={[styles.inputShell, focused ? styles.inputShellFocused : null]}>
        {leftAccessory}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.textMuted}
          secureTextEntry={isSecureEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            { flex: 1 },
            multiline ? { minHeight: Math.max(96, (numberOfLines ?? 3) * 28) } : null,
            error ? styles.inputError : null
          ]}
        />
      </View>
      {error ? <Text style={styles.helperError}>{error}</Text> : helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

export function Dialog({
  visible,
  title,
  children,
  onClose,
  footer,
  subtitle
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  subtitle?: string;
}) {
  const styles = usePrimitiveStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { padding: 18 }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.modalTitle}>{title}</Text>
              {subtitle ? <Text style={styles.helperText}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close dialog">
              <Ionicons name="close" size={24} color={tokens.colors.textSecondary} />
            </Pressable>
          </View>
          {children}
          {footer ? <View style={{ marginTop: 12 }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function BottomSheet({
  visible,
  title,
  children,
  onClose,
  footer,
  subtitle
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  subtitle?: string;
}) {
  const styles = usePrimitiveStyles();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss sheet" />
        <View
          style={[
            styles.modalCard,
            {
              alignSelf: "stretch",
              marginTop: "auto",
              maxHeight: "88%",
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              borderBottomLeftRadius: 18,
              borderBottomRightRadius: 18
            }
          ]}
        >
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View style={{ width: 44, height: 4, borderRadius: 99, backgroundColor: withAlpha(tokens.colors.textMuted, 0.28) }} />
          </View>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.modalTitle}>{title}</Text>
              {subtitle ? <Text style={styles.helperText}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sheet">
              <Ionicons name="close" size={24} color={tokens.colors.textSecondary} />
            </Pressable>
          </View>
          {children}
          {footer ? <View style={{ marginTop: 12 }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function Loader({ label }: { label?: string }) {
  const styles = usePrimitiveStyles();
  return (
    <View style={styles.loaderRow}>
      <ActivityIndicator color={tokens.colors.primaryStrong} />
      {label ? <Text style={styles.helperText}>{label}</Text> : null}
    </View>
  );
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = 12,
  style
}: {
  width?: number | `${number}%` | "auto" | undefined;
  height?: number | undefined;
  radius?: number | undefined;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = usePrimitiveStyles();
  const animated = React.useRef(new Animated.Value(0.55)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animated, { toValue: 0.92, duration: designTokens.motion.standard, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        Animated.timing(animated, { toValue: 0.55, duration: designTokens.motion.standard, useNativeDriver: true, easing: Easing.inOut(Easing.quad) })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated]);

  return <Animated.View style={[styles.skeleton, { width, height, borderRadius: radius, opacity: animated }, style]} />;
}

export function ErrorState({
  title,
  subtitle,
  action,
  icon = "alert-circle-outline"
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const styles = usePrimitiveStyles();
  return (
    <Card style={{ alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 }}>
      <View style={styles.errorIconWrap}>
        <Ionicons name={icon} size={28} color={tokens.colors.danger} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </Card>
  );
}

export function Avatar({
  name,
  size = 44,
  source,
  tone = "primary"
}: {
  name?: string | null;
  size?: number;
  source?: ImageSourcePropType | null;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const initials = React.useMemo(() => {
    if (!name) return "BP";
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "BP";
  }, [name]);

  const backgroundColor =
    tone === "success"
      ? withAlpha(tokens.colors.success, 0.16)
      : tone === "warning"
        ? withAlpha(tokens.colors.warning, 0.16)
        : tone === "danger"
          ? withAlpha(tokens.colors.danger, 0.16)
          : withAlpha(tokens.colors.primary, 0.16);

  const textColor =
    tone === "success"
      ? tokens.colors.success
      : tone === "warning"
        ? tokens.colors.warning
        : tone === "danger"
          ? tokens.colors.danger
          : tokens.colors.primaryStrong;

  React.useEffect(() => {
    const uri = typeof source === "object" && source && "uri" in source ? source.uri : null;
    if (!uri) return;
    void prefetchImage(uri);
  }, [source]);

  if (source) {
    return (
      <Image
        source={source}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tokens.colors.surfaceAlt,
          borderWidth: 1,
          borderColor: tokens.colors.border
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor,
        borderWidth: 1,
        borderColor: withAlpha(textColor, 0.2)
      }}
    >
      <Text style={{ color: textColor, fontWeight: "800", fontSize: Math.max(12, Math.round(size * 0.36)) }}>{initials}</Text>
    </View>
  );
}

export function Tag({
  label,
  tone = "primary",
  selected = false,
  onPress,
  disabled = false,
  iconLeft,
  style,
  fullWidth = false
}: {
  label: string;
  tone?: "primary" | "success" | "warning" | "danger";
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const content = (
    <View
      style={[
        {
          width: fullWidth ? "100%" : undefined,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderRadius: 999,
          paddingHorizontal: 11,
          paddingVertical: 6,
          backgroundColor: selected ? toneColor(tone, 0.18) : withAlpha(tokens.colors.surfaceAlt, 0.9),
          borderWidth: 1,
          borderColor: selected ? toneColor(tone, 0.34) : tokens.colors.border,
          opacity: disabled ? 0.6 : 1
        },
        style
      ]}
    >
      {iconLeft ? <Ionicons name={iconLeft} size={12} color={selected ? toneColor(tone, 1) : tokens.colors.textSecondary} /> : null}
      <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.45, textTransform: "uppercase", color: selected ? toneColor(tone, 1) : tokens.colors.textSecondary }}>{label}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [fullWidth && { width: "100%" }, pressed && !disabled && { opacity: 0.92, transform: [{ scale: 0.988 }] }]}
    >
      {content}
    </Pressable>
  );
}

export function Dropdown({
  label,
  value,
  options,
  placeholder = "Select an option",
  onChange,
  helperText,
  error
}: {
  label: string;
  value: string | null | undefined;
  options: Array<{ label: string; value: string; description?: string }>;
  placeholder?: string;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string | null | undefined;
}) {
  const styles = usePrimitiveStyles();
  const [visible, setVisible] = React.useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <>
      <Pressable onPress={() => setVisible(true)} accessibilityRole="button">
        <View style={{ gap: 8 }}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View
            style={{
              minHeight: 50,
              borderRadius: 18,
              backgroundColor: tokens.colors.surface,
              borderWidth: 1,
              borderColor: error ? tokens.colors.danger : tokens.colors.border,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12
            }}
          >
            <Text style={{ color: selected ? tokens.colors.text : tokens.colors.textMuted, flex: 1, fontWeight: selected ? "700" : "500" }}>{selected?.label ?? placeholder}</Text>
            <Ionicons name="chevron-down-outline" size={18} color={tokens.colors.textSecondary} />
          </View>
        </View>
      </Pressable>
      {error ? <Text style={styles.helperError}>{error}</Text> : helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
      <BottomSheet visible={visible} title={label} subtitle="Choose a value from the list below." onClose={() => setVisible(false)}>
        <View style={{ gap: 8 }}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setVisible(false);
              }}
            >
              <Card style={{ gap: 4, padding: 12, backgroundColor: option.value === value ? withAlpha(tokens.colors.primary, 0.08) : tokens.colors.surface }}>
                <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{option.label}</Text>
                {option.description ? <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>{option.description}</Text> : null}
              </Card>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

export function Typography({
  children,
  variant = "body",
  tone = "default",
  align,
  weight
}: {
  children: React.ReactNode;
  variant?: "display" | "title" | "subtitle" | "body" | "small" | "micro" | "label";
  tone?: "default" | "muted" | "secondary" | "primary" | "success" | "warning" | "danger";
  align?: "left" | "center" | "right";
  weight?: "regular" | "medium" | "semibold" | "bold" | "heavy";
}) {
  const styles = usePrimitiveStyles();
  const color =
    tone === "muted"
      ? tokens.colors.textMuted
      : tone === "secondary"
        ? tokens.colors.textSecondary
        : tone === "primary"
          ? tokens.colors.primaryStrong
          : tone === "success"
            ? tokens.colors.success
            : tone === "warning"
              ? tokens.colors.warning
              : tone === "danger"
                ? tokens.colors.danger
                : tokens.colors.text;
  const fontWeight =
    weight === "regular" ? "400" : weight === "medium" ? "500" : weight === "semibold" ? "600" : weight === "bold" ? "700" : "800";

  return (
    <Text
      style={[
        variant === "display"
          ? { fontSize: 28, fontWeight: fontWeight as any, letterSpacing: -0.45, lineHeight: 34 }
          : variant === "title"
            ? { fontSize: 22, fontWeight: fontWeight as any, letterSpacing: -0.25, lineHeight: 28 }
            : variant === "subtitle"
              ? { fontSize: 18, fontWeight: fontWeight as any, lineHeight: 24 }
              : variant === "small"
                ? { fontSize: 14, fontWeight: fontWeight as any, lineHeight: 20 }
                : variant === "micro"
                  ? { fontSize: 12, fontWeight: fontWeight as any, lineHeight: 17 }
                  : variant === "label"
                    ? { fontSize: 11, fontWeight: fontWeight as any, textTransform: "uppercase", letterSpacing: 0.7 }
                    : { fontSize: 16, fontWeight: fontWeight as any, lineHeight: 22 },
        { color, textAlign: align ?? "left" },
        variant === "label" ? styles.fieldLabel : null
      ]}
    >
      {children}
    </Text>
  );
}

export function Snackbar({
  visible,
  message,
  tone = "primary",
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 3200
}: {
  visible: boolean;
  message: string;
  tone?: "primary" | "success" | "warning" | "danger";
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  durationMs?: number;
}) {
  const [mounted, setMounted] = React.useState(visible);
  React.useEffect(() => {
    if (!visible) {
      setMounted(false);
      return;
    }
    setMounted(true);
    const timer = setTimeout(() => onDismiss?.(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss, visible]);

  if (!mounted) return null;

  const backgroundColor = toneColor(tone, 0.96);
  const accentColor =
    tone === "success"
      ? tokens.colors.success
      : tone === "warning"
        ? tokens.colors.warning
        : tone === "danger"
          ? tokens.colors.danger
          : tokens.colors.primaryStrong;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: "flex-end", padding: 16, backgroundColor: tokens.colors.overlay }}>
        <View
          style={{
            borderRadius: 22,
            borderWidth: 1,
            borderColor: withAlpha(accentColor, 0.35),
            backgroundColor,
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            ...tokens.shadow.modal
          }}
        >
          <View style={{ width: 12, height: 12, borderRadius: 99, backgroundColor: accentColor, shadowColor: accentColor, shadowOpacity: 0.45, shadowRadius: 8 }} />
          <Text style={{ flex: 1, color: tokens.colors.text, fontWeight: "700", lineHeight: 20 }}>{message}</Text>
          {actionLabel ? (
            <Pressable onPress={onAction} accessibilityRole="button">
              <Text style={{ color: accentColor, fontWeight: "800" }}>{actionLabel}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onDismiss} accessibilityRole="button">
            <Ionicons name="close" size={20} color={tokens.colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

type TableColumn<T> = {
  key: string;
  header: string;
  width?: number | `${number}%` | "auto" | undefined;
  align?: "left" | "center" | "right";
  render: (row: T) => React.ReactNode;
};

export function Table<T>({
  columns,
  rows,
  keyExtractor,
  emptyTitle = "Nothing to show",
  emptySubtitle = "There are no rows in this table yet."
}: {
  columns: Array<TableColumn<T>>;
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
  emptyTitle?: string;
  emptySubtitle?: string;
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} subtitle={emptySubtitle} icon="grid-outline" />;
  }

  return (
    <Card style={{ gap: 10, padding: 12 }}>
      <View style={{ flexDirection: "row", gap: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.border }}>
        {columns.map((column) => (
          <Text
            key={column.key}
            style={{
              flex: typeof column.width === "number" ? undefined : 1,
              width: column.width,
              color: tokens.colors.textMuted,
              fontSize: 11,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              textAlign: column.align ?? "left"
            }}
          >
            {column.header}
          </Text>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        {rows.map((row, index) => (
          <View
            key={keyExtractor(row, index)}
            style={{
              flexDirection: "row",
              gap: 10,
              paddingVertical: 8,
              paddingHorizontal: 2,
              borderRadius: 14,
              backgroundColor: index % 2 === 0 ? withAlpha(tokens.colors.surfaceAlt, 0.38) : "transparent"
            }}
          >
            {columns.map((column) => (
              <View key={column.key} style={{ flex: typeof column.width === "number" ? undefined : 1, width: column.width, alignItems: column.align === "center" ? "center" : column.align === "right" ? "flex-end" : "flex-start" }}>
                {column.render(row)}
              </View>
            ))}
          </View>
        ))}
      </View>
    </Card>
  );
}

export function FloatingActionButton({
  label,
  icon = "add",
  onPress
}: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          position: "absolute",
          right: 18,
          bottom: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 999,
          backgroundColor: tokens.colors.primaryStrong,
          borderWidth: 1,
          borderColor: withAlpha("#FFFFFF", 0.16),
          ...tokens.shadow.modal
        },
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }
      ]}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      {label ? <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 13 }}>{label}</Text> : null}
    </Pressable>
  );
}

type SwipeAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "danger";
  onPress: () => void;
};

export function SwipeableActionRow({
  children,
  leftActions = [],
  rightActions = []
}: {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
}) {
  if (!leftActions.length && !rightActions.length) {
    return <>{children}</>;
  }

  const renderActions = (actions: SwipeAction[], align: "flex-start" | "flex-end") => (_progress: Animated.AnimatedInterpolation<string | number>, _dragX: Animated.AnimatedInterpolation<string | number>) => (
    <View style={{ flex: 1, flexDirection: "row", justifyContent: align, alignItems: "stretch", gap: 8, paddingVertical: 8 }}>
      {actions.map((action) => {
        const tone = action.tone ?? "primary";
        const backgroundColor =
          tone === "success"
            ? withAlpha(tokens.colors.success, 0.92)
            : tone === "warning"
              ? withAlpha(tokens.colors.warning, 0.92)
              : tone === "danger"
                ? withAlpha(tokens.colors.danger, 0.92)
                : withAlpha(tokens.colors.primaryStrong, 0.92);
        return (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            accessibilityRole="button"
            style={{
              minWidth: 92,
              marginHorizontal: 4,
              borderRadius: 18,
              backgroundColor,
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14
            }}
          >
            <Ionicons name={action.icon} size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{action.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const swipeableProps: Partial<React.ComponentProps<typeof Swipeable>> = {};
  if (leftActions.length) {
    swipeableProps.renderLeftActions = renderActions(leftActions, "flex-start");
  }
  if (rightActions.length) {
    swipeableProps.renderRightActions = renderActions(rightActions, "flex-end");
  }

  return <Swipeable {...swipeableProps}>{children}</Swipeable>;
}

export const DatePicker = DateRangePickerModal;

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

const prefetchedImages = new Map<string, Promise<void>>();

function prefetchImage(uri: string) {
  if (prefetchedImages.has(uri)) {
    return prefetchedImages.get(uri)!;
  }
  const request = Image.prefetch(uri).then(() => undefined).catch(() => undefined);
  prefetchedImages.set(uri, request);
  return request;
}

function buttonStyle(variant: ButtonVariant) {
  if (variant === "secondary") return { backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border };
  if (variant === "danger") return { backgroundColor: tokens.colors.danger, ...tokens.shadow.card };
  if (variant === "ghost") return { backgroundColor: "transparent", borderWidth: 1, borderColor: tokens.colors.border };
  return { backgroundColor: tokens.colors.primary, ...tokens.shadow.card };
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
      backgroundColor: tokens.colors.background
    },
    screenBackdrop: {
      ...StyleSheet.absoluteFillObject,
      overflow: "hidden"
    },
    screenGlowPrimary: {
      position: "absolute",
      top: -120,
      right: -80,
      width: 260,
      height: 260,
      borderRadius: 999,
      opacity: 0.18
    },
    screenGlowSecondary: {
      position: "absolute",
      bottom: -120,
      left: -100,
      width: 280,
      height: 280,
      borderRadius: 999,
      backgroundColor: withAlpha(tokens.colors.success, 0.08)
    },
    screenContent: {
      flex: 1
    },
    header: {
      marginHorizontal: 16,
      paddingHorizontal: 16,
      paddingVertical: 18,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      overflow: "hidden"
    },
    headerPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: withAlpha(tokens.colors.primaryStrong, 0.08),
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.primaryStrong, 0.18)
    },
    headerPillText: {
      color: tokens.colors.primaryStrong,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase"
    },
    title: { color: tokens.colors.text, fontSize: 25, fontWeight: "900", letterSpacing: -0.4, lineHeight: 30 },
    subtitle: { color: tokens.colors.textSecondary, marginTop: 2, fontSize: 12.5, lineHeight: 18 },
    card: {
      backgroundColor: tokens.colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      padding: 16,
      overflow: "hidden",
      ...tokens.shadow.card
    },
    statCard: { gap: 8, minHeight: 124, paddingTop: 18 },
    statAccentBar: {
      height: 3,
      width: 42,
      borderRadius: 99
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center"
    },
    statLabel: { color: tokens.colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 },
    statValue: { color: tokens.colors.text, fontSize: 21, fontWeight: "900", letterSpacing: -0.2 },
    statHint: { color: tokens.colors.textSecondary, fontSize: 12 },
    button: {
      minHeight: 50,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16
    },
    buttonText: { color: tokens.colors.text, fontSize: 14, fontWeight: "800", letterSpacing: 0.2 },
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
      minHeight: 24,
      paddingVertical: 14,
      paddingHorizontal: 0,
      backgroundColor: "transparent",
      color: tokens.colors.text,
      fontSize: 14
    },
    inputShell: {
      minHeight: 50,
      borderRadius: 18,
      backgroundColor: withAlpha(tokens.colors.surface, 0.98),
      borderWidth: 1,
      borderColor: tokens.colors.border,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    inputShellFocused: {
      borderColor: withAlpha(tokens.colors.primaryStrong, 0.7),
      shadowColor: tokens.colors.primaryStrong,
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3
    },
    inputError: {
      borderColor: tokens.colors.danger,
      backgroundColor: withAlpha(tokens.colors.danger, 0.06)
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      alignSelf: "flex-start"
    },
    badgeText: { fontSize: 10.5, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.45 },
    empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(tokens.colors.primary, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.primary, 0.16)
    },
    emptyBadge: {
      alignSelf: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: withAlpha(tokens.colors.primaryStrong, 0.08),
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.primaryStrong, 0.16)
    },
    emptyBadgeText: {
      color: tokens.colors.primaryStrong,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase"
    },
    emptyTitle: { color: tokens.colors.text, fontSize: 19, fontWeight: "900", textAlign: "center", letterSpacing: -0.2 },
    emptySubtitle: { color: tokens.colors.textSecondary, textAlign: "center", lineHeight: 21, maxWidth: 360 },
    helperText: { color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 },
    helperError: { color: tokens.colors.danger, fontSize: 12, lineHeight: 17, fontWeight: "700" },
    successBadge: {
      alignSelf: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: withAlpha(tokens.colors.success, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.success, 0.16)
    },
    successBadgeText: {
      color: tokens.colors.success,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase"
    },
    errorIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(tokens.colors.danger, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.danger, 0.18)
    },
    loaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10
    },
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
      padding: 18,
      ...tokens.shadow.modal
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
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 16,
      paddingBottom: 28
    },
    skeleton: {
      backgroundColor: withAlpha(tokens.colors.textMuted, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.border, 0.5)
    },
    footer: {
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 10,
      backgroundColor: "transparent"
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
