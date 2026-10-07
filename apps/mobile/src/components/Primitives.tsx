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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "@/store/useAppStore";
import { tokens } from "@/theme/tokens";
import { useThemeTokens } from "@/theme";
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
  const content = (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
      <View pointerEvents="none" style={styles.screenBackdrop}>
        <LinearGradient colors={tokens.gradients.surface} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={tokens.gradients.premium} style={styles.screenGlowPrimary} />
        <View style={styles.screenGlowSecondary} />
      </View>
      <Animated.View style={[styles.screenContent, motion as any]}>{children}</Animated.View>
      {hideFooter ? null : <AppFooter />}
    </SafeAreaView>
  );

  // Android already resizes the edge-to-edge window via adjustResize. An extra
  // KeyboardAvoidingView causes repeated layout/focus churn while the IME is
  // composing text, so only use it on iOS where it is needed.
  return Platform.OS === "ios" ? <KeyboardAvoidingView style={styles.screen} behavior="padding">{content}</KeyboardAvoidingView> : content;
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
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
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
    <View style={styles.header}>
      <View style={styles.headerBrandMark}>
        <Text style={styles.headerBrand}>D</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
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
  const insets = useSafeAreaInsets();
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
      <View style={[styles.modalOverlay, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.modalCard, { padding: 16, backgroundColor: tokens.colors.surfaceElevated }]}>
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
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  style,
  textStyle
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return <Button title={title} onPress={onPress} loading={loading} variant={variant} disabled={disabled} iconLeft={iconLeft} iconRight={iconRight} fullWidth={fullWidth} style={style} textStyle={textStyle} />;
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
  autoFocus = false,
  disabled = false
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
  disabled?: boolean;
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
      disabled={disabled}
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

export function InfoIcon({
  message,
  label = "More information",
  size = 16
}: {
  message: string;
  label?: string;
  size?: number;
}) {
  const styles = usePrimitiveStyles();
  const [visible, setVisible] = React.useState(false);
  return (
    <View style={styles.infoIconAnchor}>
      <Pressable
        onPress={() => setVisible((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: visible }}
        hitSlop={8}
      >
        <Ionicons name="information-circle-outline" size={size} color={tokens.colors.textMuted} />
      </Pressable>
      {visible ? (
        <View style={styles.infoTooltip} accessibilityRole="text">
          <Text style={styles.infoTooltipText}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  loading = false,
  compact = false
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  compact?: boolean;
}) {
  const styles = usePrimitiveStyles();
  const pages = paginationPages(currentPage, totalPages);
  if (totalPages <= 1) return null;
  return (
    <View style={[styles.paginationContainer, compact && styles.paginationCompact]} accessibilityRole="adjustable" accessibilityLabel={`Page ${currentPage} of ${totalPages}`}>
      <Pressable
        onPress={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={loading || currentPage <= 1}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        style={({ pressed }) => [styles.paginationControl, (loading || currentPage <= 1) && styles.paginationDisabled, pressed && styles.paginationPressed]}
      >
        <Ionicons name="chevron-back" size={16} color={currentPage <= 1 ? tokens.colors.disabled : tokens.colors.textSecondary} />
      </Pressable>
      {compact ? (
        <Text style={styles.paginationEllipsis}>{currentPage} / {totalPages}</Text>
      ) : null}
      {!compact ? pages.map((page, index) =>
        page === "ellipsis" ? (
          <Text key={`ellipsis-${index}`} style={styles.paginationEllipsis}>...</Text>
        ) : (
          <Pressable
            key={page}
            onPress={() => onPageChange(page)}
            disabled={loading || page === currentPage}
            accessibilityRole="button"
            accessibilityState={{ selected: page === currentPage, disabled: loading || page === currentPage }}
            style={({ pressed }) => [styles.paginationPage, page === currentPage && styles.paginationPageActive, pressed && styles.paginationPressed]}
          >
            <Text style={[styles.paginationPageText, page === currentPage && styles.paginationPageTextActive]}>{page}</Text>
          </Pressable>
        )
      ) : null}
      <Pressable
        onPress={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={loading || currentPage >= totalPages}
        accessibilityRole="button"
        accessibilityLabel="Next page"
        style={({ pressed }) => [styles.paginationControl, (loading || currentPage >= totalPages) && styles.paginationDisabled, pressed && styles.paginationPressed]}
      >
        <Ionicons name="chevron-forward" size={16} color={currentPage >= totalPages ? tokens.colors.disabled : tokens.colors.textSecondary} />
      </Pressable>
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
          <Ionicons name={icon} size={26} color={tokens.colors.primaryStrong} />
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {action ? <View style={{ marginTop: 10 }}>{action}</View> : null}
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
    <Card style={{ alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 }}>
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
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
      {action ? <View style={{ marginTop: 10 }}>{action}</View> : null}
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
      // Prevent Android from moving focus to the nearest action control when a
      // controlled TextInput publishes a new value.
      focusable={false}
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

export const Input = React.memo(function Input({
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
  autoFocus = false,
  disabled = false
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
  disabled?: boolean | undefined;
}) {
  const inputRef = React.useRef<React.ElementRef<typeof TextInput>>(null);
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const styles = usePrimitiveStyles();
  const isSecureEntry = secureTextEntry ? !passwordVisible : false;
  const nativeValueRef = React.useRef(value);
  const focusedRef = React.useRef(false);

  // Keep the native editor's text buffer independent from the form rerender.
  // On Android/Fabric, feeding every keystroke straight back through `value`
  // can replace the served input connection and move focus to another view.
  // Do not synchronize while the IME owns the composing buffer; this is
  // especially important for transformed auth fields such as reset codes.
  React.useEffect(() => {
    if (value === nativeValueRef.current || focusedRef.current) return;
    nativeValueRef.current = value;
    inputRef.current?.setNativeProps({ text: value });
  }, [value, focused]);

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.fieldLabelRow}>
        <Pressable
          onPress={() => inputRef.current?.focus()}
          // Labels are only a convenience tap target. They must not enter the
          // Android focus chain and steal focus from the TextInput after a
          // controlled value update.
          accessible={false}
          focusable={false}
        >
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
      <View style={[styles.inputShell, focused ? styles.inputShellFocused : null, disabled ? styles.inputShellDisabled : null]}>
        {leftAccessory}
        <TextInput
          ref={inputRef}
          defaultValue={value}
          onChangeText={(nextValue) => {
            nativeValueRef.current = nextValue;
            onChangeText(nextValue);
          }}
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
          editable={!disabled}
          accessibilityState={{ disabled }}
          onFocus={() => {
            focusedRef.current = true;
            setFocused(true);
          }}
          onBlur={() => {
            focusedRef.current = false;
            setFocused(false);
          }}
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
});

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
  const insets = useSafeAreaInsets();
  const modalContent = (
    <View style={styles.modalCard}>
      <View style={styles.modalHeader}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.modalTitle}>{title}</Text>
          {subtitle ? <Text style={styles.helperText}>{subtitle}</Text> : null}
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close dialog">
          <Ionicons name="close" size={24} color={tokens.colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
      >
        {children}
        {footer ? <View style={{ marginTop: 10 }}>{footer}</View> : null}
      </ScrollView>
    </View>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
        {Platform.OS === "ios" ? <KeyboardAvoidingView style={{ width: "100%", maxHeight: "100%" }} behavior="padding">{modalContent}</KeyboardAvoidingView> : modalContent}
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
  const insets = useSafeAreaInsets();
  const sheetContent = (
    <View
      style={[
        styles.modalCard,
        {
          alignSelf: "stretch",
          marginTop: "auto",
          maxHeight: "86%",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16
        }
      ]}
    >
      <View style={{ alignItems: "center", marginBottom: 10 }}>
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
      >
        {children}
        {footer ? <View style={{ marginTop: 10 }}>{footer}</View> : null}
      </ScrollView>
    </View>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss sheet" />
        {Platform.OS === "ios" ? <KeyboardAvoidingView style={{ width: "100%", marginTop: "auto" }} behavior="padding">{sheetContent}</KeyboardAvoidingView> : sheetContent}
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

export function LoadingState({ label = "Loading" }: { label?: string }) {
  const styles = usePrimitiveStyles();
  return (
    <Card style={styles.loadingState}>
      <ActivityIndicator color={tokens.colors.primaryStrong} />
      <Text style={styles.loadingStateText}>{label}</Text>
    </Card>
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
    <Card style={{ alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 }}>
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
          backgroundColor: selected ? toneColor(tone, 0.18) : tokens.colors.surfaceElevated,
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
  error,
  disabled = false
}: {
  label: string;
  value: string | null | undefined;
  options: Array<{ label: string; value: string; description?: string }>;
  placeholder?: string;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string | null | undefined;
  disabled?: boolean;
}) {
  const styles = usePrimitiveStyles();
  const [visible, setVisible] = React.useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <>
      <Pressable onPress={() => setVisible(true)} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled, expanded: visible }}>
        <View style={{ gap: 8 }}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View
            style={{
              minHeight: 42,
              borderRadius: 12,
              backgroundColor: tokens.colors.input,
              borderWidth: 1,
              borderColor: error ? tokens.colors.danger : tokens.colors.border,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              opacity: disabled ? 0.58 : 1
            }}
          >
            <Text style={{ color: selected ? tokens.colors.text : tokens.colors.textMuted, flex: 1, fontWeight: selected ? "700" : "500", fontSize: 13 }}>{selected?.label ?? placeholder}</Text>
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
              <Card style={{ gap: 4, padding: 12, backgroundColor: option.value === value ? withAlpha(tokens.colors.primary, 0.08) : tokens.colors.surfaceElevated }}>
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
          ? { fontSize: 24, fontWeight: fontWeight as any, letterSpacing: -0.35, lineHeight: 29 }
          : variant === "title"
            ? { fontSize: 20, fontWeight: fontWeight as any, letterSpacing: -0.2, lineHeight: 25 }
            : variant === "subtitle"
              ? { fontSize: 16, fontWeight: fontWeight as any, lineHeight: 21 }
              : variant === "small"
                ? { fontSize: 12, fontWeight: fontWeight as any, lineHeight: 18 }
                : variant === "micro"
                  ? { fontSize: 11, fontWeight: fontWeight as any, lineHeight: 16 }
                  : variant === "label"
                    ? { fontSize: 11, fontWeight: fontWeight as any, textTransform: "uppercase", letterSpacing: 0.7 }
                  : { fontSize: 14, fontWeight: fontWeight as any, lineHeight: 20 },
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
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(accentColor, 0.35),
            backgroundColor,
            paddingHorizontal: 16,
            paddingVertical: 11,
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
              backgroundColor: index % 2 === 0 ? tokens.colors.surfaceAlt : "transparent"
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

  // react-native-gesture-handler currently exposes React 18 types while the app uses React 19.
  // Keep the compatibility cast at this integration boundary instead of weakening app-wide types.
  return React.createElement(Swipeable as unknown as React.ElementType, swipeableProps as Record<string, unknown>, children);
}

export const DatePicker = DateRangePickerModal;

function paginationPages(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  const safeCurrent = Math.max(1, Math.min(currentPage, totalPages));
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (safeCurrent <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages];
  }
  if (safeCurrent >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis", safeCurrent - 1, safeCurrent, safeCurrent + 1, "ellipsis", totalPages];
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
  if (variant === "secondary") return { backgroundColor: tokens.colors.surfaceElevated, borderWidth: 1, borderColor: tokens.colors.border };
  if (variant === "danger") return { backgroundColor: tokens.colors.danger, ...tokens.shadow.card };
  if (variant === "ghost") return { backgroundColor: "transparent", borderWidth: 1, borderColor: tokens.colors.border };
  return { backgroundColor: tokens.colors.primary, ...tokens.shadow.card };
}

function usePrimitiveStyles() {
  const theme = useThemeTokens();
  return React.useMemo(() => createStyles(theme), [theme]);
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

function createStyles(theme: ReturnType<typeof useThemeTokens>) {
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
      right: -90,
      width: 220,
      height: 220,
      borderRadius: 999,
      opacity: 0.035
    },
    screenGlowSecondary: {
      position: "absolute",
      bottom: -130,
      left: -110,
      width: 220,
      height: 220,
      borderRadius: 999,
      backgroundColor: withAlpha(tokens.colors.primary, 0.025)
    },
    screenContent: {
      flex: 1
    },
    header: {
      marginHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      overflow: "hidden"
    },
    headerBrandMark: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(tokens.colors.primaryStrong, 0.14),
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.primaryStrong, 0.26)
    },
    headerBrand: { color: tokens.colors.primaryStrong, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 },
    title: { color: tokens.colors.text, fontSize: 21, fontWeight: "900", letterSpacing: -0.45, lineHeight: 25 },
    subtitle: { color: tokens.colors.textSecondary, marginTop: 1, fontSize: 11, lineHeight: 15 },
    card: {
      backgroundColor: tokens.colors.surfaceCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      padding: 14,
      overflow: "hidden",
      ...tokens.shadow.card
    },
    statCard: { gap: 6, minHeight: 96, paddingTop: 12 },
    statAccentBar: {
      height: 3,
      width: 40,
      borderRadius: 99
    },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center"
    },
    statLabel: { color: tokens.colors.textMuted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.7 },
    statValue: { color: tokens.colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
    statHint: { color: tokens.colors.textSecondary, fontSize: 11 },
    button: {
      minHeight: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14
    },
    buttonText: { color: tokens.colors.text, fontSize: 12, fontWeight: "800", letterSpacing: 0.1 },
    fieldLabel: { color: tokens.colors.textSecondary, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
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
      minHeight: 20,
      paddingVertical: 8,
      paddingHorizontal: 0,
      backgroundColor: "transparent",
      color: tokens.colors.text,
      fontSize: 13
    },
    inputShell: {
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: tokens.colors.input,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      paddingHorizontal: 11,
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    inputShellFocused: {
      borderColor: withAlpha(tokens.colors.primaryStrong, 0.7),
      shadowColor: tokens.colors.primaryStrong,
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3
    },
    inputShellDisabled: {
      opacity: 0.58,
      backgroundColor: tokens.colors.surfaceAlt
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
    badgeText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },
    empty: { alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10 },
    emptyIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
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
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase"
    },
    emptyTitle: { color: tokens.colors.text, fontSize: 15, fontWeight: "900", textAlign: "center", letterSpacing: -0.1 },
    emptySubtitle: { color: tokens.colors.textSecondary, textAlign: "center", lineHeight: 16, maxWidth: 340, fontSize: 11 },
    helperText: { color: tokens.colors.textSecondary, fontSize: 11, lineHeight: 16 },
    helperError: { color: tokens.colors.danger, fontSize: 11, lineHeight: 16, fontWeight: "700" },
    successBadge: {
      alignSelf: "center",
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: withAlpha(tokens.colors.success, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.success, 0.16)
    },
    successBadgeText: {
      color: tokens.colors.success,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase"
    },
    errorIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
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
    loadingState: {
      minHeight: 64,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 10
    },
    loadingStateText: {
      color: tokens.colors.textSecondary,
      fontSize: 11,
      fontWeight: "700"
    },
    infoIconAnchor: {
      position: "relative",
      zIndex: 2
    },
    infoTooltip: {
      position: "absolute",
      right: 0,
      top: 24,
      width: 220,
      padding: 10,
      borderRadius: 10,
      backgroundColor: tokens.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      ...tokens.shadow.modal
    },
    infoTooltipText: {
      color: tokens.colors.textSecondary,
      fontSize: 11,
      lineHeight: 16
    },
    paginationContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 4
    },
    paginationCompact: {
      justifyContent: "space-between"
    },
    paginationControl: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: tokens.colors.border,
      backgroundColor: tokens.colors.surfaceElevated
    },
    paginationPage: {
      minWidth: 30,
      height: 30,
      paddingHorizontal: 8,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center"
    },
    paginationPageActive: {
      backgroundColor: tokens.colors.primaryStrong
    },
    paginationPageText: {
      color: tokens.colors.textSecondary,
      fontSize: 11,
      fontWeight: "800"
    },
    paginationPageTextActive: {
      color: "#FFFFFF"
    },
    paginationEllipsis: {
      width: 24,
      textAlign: "center",
      color: tokens.colors.textMuted,
      fontSize: 12
    },
    paginationDisabled: {
      opacity: 0.45
    },
    paginationPressed: {
      opacity: 0.78
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: tokens.colors.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 12
    },
    modalCard: {
      width: "100%",
      maxHeight: "90%",
      backgroundColor: tokens.colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      padding: 14,
      ...tokens.shadow.modal
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12
    },
    modalTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: "900" },
    calendarShell: {
      backgroundColor: tokens.colors.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tokens.colors.border,
      padding: 10,
      gap: 10
    },
    calendarTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10
    },
    calendarNavButton: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tokens.colors.surface,
      borderWidth: 1,
      borderColor: tokens.colors.border
    },
    calendarMonth: {
      color: tokens.colors.text,
      fontSize: 14,
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
      width: 34,
      height: 34,
      borderRadius: 12,
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
      width: 34,
      height: 34
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
      paddingHorizontal: 12,
      paddingTop: 8,
      gap: 8,
      paddingBottom: 16
    },
    skeleton: {
      backgroundColor: withAlpha(tokens.colors.textMuted, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(tokens.colors.border, 0.5)
    },
    footer: {
      alignItems: "center",
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 8,
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
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
      textAlign: "center"
    }
  });
}
