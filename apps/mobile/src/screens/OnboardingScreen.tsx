import React from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { PLAN_EMPLOYEE_LIMITS, PLAN_NAMES, PLAN_PRICING, PLAN_TIERS, businessSetupSchema, listIndustryModules, resolveBusinessTypeConfig, resolveIndustryModule } from "@shared";
import { AppScrollView, Badge, Card, InputField, PrimaryButton, Screen } from "@/components/Primitives";
import { AuthCompactHeader, AuthMessage } from "@/components/AuthComponents";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { z } from "zod";
import { getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

type FormValues = z.infer<typeof businessSetupSchema>;
type SetupStepKey = "business" | "industry" | "type" | "plan" | "security" | "finish";
type CountryOption = { code: CountryCode; name: string; callingCode: string; flag: string };

const industryModules = listIndustryModules();
const defaultIndustry = industryModules[0]!;
const defaultIndustryKey = defaultIndustry?.key ?? "retail";
const defaultBusinessType = defaultIndustry?.businessTypes[0]?.value ?? "retail_shop";
const planOptions = PLAN_TIERS;
const countryNames = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const countryOptions: CountryOption[] = getCountries()
  .map((code) => ({ code, name: countryNames?.of(code) ?? code, callingCode: `+${getCountryCallingCode(code)}`, flag: countryFlag(code) }))
  .sort((left, right) => left.name.localeCompare(right.name));
const defaultCountry = countryOptions.find((country) => country.code === "KE") ?? countryOptions[0]!;

const steps: Array<{ key: SetupStepKey; title: string; subtitle: string }> = [
  { key: "business", title: "Business information", subtitle: "Owner & business details" },
  { key: "industry", title: "Industry", subtitle: "Choose your industry" },
  { key: "type", title: "Business type", subtitle: "Choose a business type" },
  { key: "plan", title: "Subscription plan", subtitle: "Choose a starting plan" },
  { key: "security", title: "Security", subtitle: "Set up your login" },
  { key: "finish", title: "Finish", subtitle: "Review and create" },
];

const stepFieldMap: Record<Exclude<SetupStepKey, "finish">, Array<keyof FormValues>> = {
  business: ["ownerName", "phone", "businessName", "branchName", "currency"],
  industry: ["industryKey"],
  type: ["businessType"],
  plan: ["planTier"],
  security: ["password", "cashierPin"],
};

export function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const loading = useAppStore((state) => state.loading);
  const activateSession = useAppStore((state) => state.activateSession);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const [submitting, setSubmitting] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [countryPickerVisible, setCountryPickerVisible] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState("");
  const [country, setCountry] = React.useState<CountryOption>(defaultCountry);
  const [setupError, setSetupError] = React.useState<string | null>(null);
  const {
    control,
    handleSubmit,
    trigger,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(businessSetupSchema),
    defaultValues: {
      ownerName: "",
      phone: "",
      password: "",
      businessName: "",
      industryKey: defaultIndustryKey,
      businessType: defaultBusinessType,
      planTier: "command",
      currency: "KES",
      branchName: "Main Shop",
      cashierPin: "",
    },
  });

  const selectedIndustryKey = watch("industryKey");
  const selectedBusinessType = watch("businessType");
  const selectedPlan = watch("planTier");
  const activeStep = steps[stepIndex]!;
  const selectedIndustry = React.useMemo(
    () => resolveIndustryModule({ industryKey: selectedIndustryKey, businessType: selectedBusinessType }),
    [selectedBusinessType, selectedIndustryKey]
  );
  const businessTypeOptions = selectedIndustry.businessTypes;
  const selectedTypeOption = businessTypeOptions.find((option) => option.value === selectedBusinessType) ?? businessTypeOptions[0] ?? null;
  const selectedBusinessConfig = React.useMemo(
    () => resolveBusinessTypeConfig({ industryKey: selectedIndustryKey, businessType: selectedBusinessType }),
    [selectedBusinessType, selectedIndustryKey]
  );

  React.useEffect(() => {
    if (!businessTypeOptions.length) return;
    if (!businessTypeOptions.some((option) => option.value === selectedBusinessType)) {
      setValue("businessType", businessTypeOptions[0]!.value, { shouldDirty: true, shouldTouch: true });
    }
  }, [businessTypeOptions, selectedBusinessType, setValue]);

  async function handleAdvance() {
    const fields = stepFieldMap[activeStep.key as Exclude<SetupStepKey, "finish">];
    const valid = await trigger(fields, { shouldFocus: true });
    if (!valid) return;
    setSetupError(null);
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submit(values: FormValues) {
    const parsedPhone = parsePhoneNumberFromString(values.phone, country.code);
    if (!parsedPhone || !isValidPhoneNumber(values.phone, country.code)) {
      setError("phone", { type: "validate", message: `Enter a valid phone number for ${country.name}.` });
      setStepIndex(0);
      return;
    }
    setSubmitting(true);
    try {
      const result = await completeOnboarding({ ...values, phone: parsedPhone.number, phoneLocal: values.phone });
      Alert.alert("Setup complete", "Your owner account and business were saved successfully. Tap Continue to open the app.", [
        {
          text: "Continue",
          onPress: () => {
            void activateSession({ business: result.business, session: result.session }).catch((error) => {
              Alert.alert("Setup failed", error instanceof Error ? error.message : "Failed to finish signing you in.");
            });
          },
        },
      ]);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to complete setup. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onInvalid(validationErrors: typeof errors) {
    const firstError = Object.values(validationErrors)[0];
    setSetupError(firstError?.message ?? "Please complete all required fields before continuing.");
  }

  return (
    <Screen hideFooter>
      <AppScrollView contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
        <AuthCompactHeader eyebrow="Setup" />
        <View style={{ gap: 8, paddingHorizontal: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 20, lineHeight: 25, fontWeight: "900", letterSpacing: -0.4 }}>{activeStep.title}</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 12 }}>{activeStep.subtitle}</Text>
            </View>
            <Text style={{ color: tokens.colors.primaryStrong, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>STEP {stepIndex + 1} / {steps.length}</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={`Setup progress, step ${stepIndex + 1} of ${steps.length}: ${activeStep.title}`} accessibilityValue={{ min: 1, max: steps.length, now: stepIndex + 1 }} style={{ flexDirection: "row", gap: 4 }}>
            {steps.map((step, index) => (
              <View key={step.key} style={{ flex: 1, height: 3, borderRadius: 999, backgroundColor: index <= stepIndex ? tokens.colors.primaryStrong : tokens.colors.border }} />
            ))}
          </View>
        </View>

        {stepIndex === 0 ? (
          <Card style={{ gap: 9, padding: 11, borderRadius: 14 }}>
            <Controller
              control={control}
              name="ownerName"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Owner name"
                  value={value}
                  onChangeText={(next) => { setSetupError(null); onChange(next); }}
                  placeholder="Your full name"
                  error={errors.ownerName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange } }) => (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: tokens.colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.55, textTransform: "uppercase" }}>Phone number</Text>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Pressable
                      onPress={() => setCountryPickerVisible(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Country code ${country.name} ${country.callingCode}`}
                      style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.surfaceAlt, justifyContent: "center" }}
                    >
                      <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>{country.flag} {country.callingCode}</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <InputField
                        label=""
                        value={value}
                        onChangeText={(next) => { clearErrors("phone"); setSetupError(null); onChange(next.replace(/[^\d\s()-]/g, "")); }}
                        placeholder="712 345 678"
                        keyboardType="phone-pad"
                        error={errors.phone?.message}
                      />
                    </View>
                  </View>
                </View>
              )}
            />
            <Controller
              control={control}
              name="businessName"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Business name"
                  value={value}
                  onChangeText={(next) => { setSetupError(null); onChange(next); }}
                  placeholder="Your business name"
                  error={errors.businessName?.message}
                  helperText="Shown on receipts"
                />
              )}
            />
            <Controller
              control={control}
              name="branchName"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Branch"
                  value={value}
                  onChangeText={(next) => { setSetupError(null); onChange(next); }}
                  placeholder="Main shop"
                  error={errors.branchName?.message}
                  helperText="Add more later"
                />
              )}
            />
            <Controller
              control={control}
              name="currency"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Currency"
                  value={value}
                  onChangeText={(next) => { setSetupError(null); onChange(next); }}
                  placeholder="KES"
                  error={errors.currency?.message}
                  helperText="3-letter currency code"
                />
              )}
            />
          </Card>
        ) : null}

        {stepIndex === 1 ? (
          <Card style={{ gap: 8, padding: 11 }}>
            <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
              Choose the industry that best matches the business. The rest of the setup will adapt to that selection.
            </Text>
            <View style={{ gap: 10 }}>
              {industryModules.map((module) => {
                const selected = module.key === selectedIndustry.key;
                return (
                  <Pressable
                    key={module.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${module.label}${selected ? ", selected" : ""}`}
                    onPress={() => {
                      setValue("industryKey", module.key, { shouldDirty: true, shouldTouch: true });
                      setValue("businessType", module.businessTypes[0]!.value, { shouldDirty: true, shouldTouch: true });
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                  >
                  <Card
                      style={{
                        gap: 7,
                        padding: 10,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderColor: selected ? tokens.colors.success : tokens.colors.border,
                        backgroundColor: selected ? `${tokens.colors.success}18` : tokens.colors.surfaceAlt,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{module.label}</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>{module.description}</Text>
                        </View>
                        <Badge label={selected ? "Selected" : `${module.businessTypes.length} types`} tone={selected ? "success" : "primary"} />
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {module.features.slice(0, 3).map((feature) => (
                          <Badge key={feature} label={feature} tone="primary" />
                        ))}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        {stepIndex === 2 ? (
          <Card style={{ gap: 8, padding: 11 }}>
            <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
              We&apos;ll tailor the workspace to the selected industry. Pick the type that best describes how the business operates.
            </Text>
            <View style={{ padding: 9, borderRadius: 12, backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border, gap: 3 }}>
              <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11 }}>Selected industry</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{selectedIndustry.label}</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{selectedIndustry.dashboard.summary}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {selectedBusinessConfig.onboarding.map((item) => <Badge key={item} label={`Setup: ${item}`} tone="success" />)}
              </View>
            </View>
            <View style={{ gap: 10 }}>
              {businessTypeOptions.map((option) => {
                const selected = selectedBusinessType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label}${selected ? ", selected" : ""}`}
                    onPress={() => setValue("businessType", option.value, { shouldDirty: true, shouldTouch: true })}
                    style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                  >
                    <Card
                      style={{
                        gap: 6,
                        padding: 10,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderColor: selected ? tokens.colors.primaryStrong : tokens.colors.border,
                        backgroundColor: selected ? `${tokens.colors.primary}18` : tokens.colors.surfaceAlt,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }}>{option.label}</Text>
                          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>{option.description}</Text>
                        </View>
                        <Badge label={selected ? "Chosen" : "Pick"} tone={selected ? "success" : "primary"} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
            {selectedTypeOption ? (
              <Card style={{ gap: 6, padding: 10, borderRadius: 13, backgroundColor: `${tokens.colors.success}12` }}>
                <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }}>{selectedTypeOption.label} workflow</Text>
                <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{selectedBusinessConfig.workflow.steps.join("  >  ")}</Text>
              </Card>
            ) : null}
          </Card>
        ) : null}

        {stepIndex === 3 ? (
          <Card style={{ gap: 8, padding: 11 }}>
            <View style={{ padding: 9, borderRadius: 12, backgroundColor: `${tokens.colors.success}18`, borderWidth: 1, borderColor: tokens.colors.success, gap: 3 }}>
              <Text style={{ color: tokens.colors.success, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 }}>30 DAYS FREE · NO CARD REQUIRED</Text>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>Your selected plan starts after the trial.</Text>
            </View>
            <View style={{ gap: 10 }}>
              {planOptions.map((plan) => {
                const selected = selectedPlan === plan;
                return (
                  <Pressable
                    key={plan}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${PLAN_NAMES[plan]}, ${PLAN_PRICING[plan].toLocaleString()} per month${selected ? ", selected" : ""}`}
                    onPress={() => setValue("planTier", plan, { shouldDirty: true, shouldTouch: true })}
                    style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                  >
                    <Card
                      style={{
                        gap: 6,
                        padding: 10,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderColor: selected ? tokens.colors.success : tokens.colors.border,
                        backgroundColor: selected ? `${tokens.colors.success}18` : tokens.colors.surfaceAlt,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{PLAN_NAMES[plan]}</Text>
                          <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>KSh {PLAN_PRICING[plan].toLocaleString()}/month</Text>
                          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{plan === "enterprise" ? "10+ employees" : `Up to ${PLAN_EMPLOYEE_LIMITS[plan]} employees`}</Text>
                        </View>
                        <Badge label={selected ? "Selected" : "Choose"} tone={selected ? "success" : "primary"} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        {stepIndex === 4 ? (
          <Card style={{ gap: 9, padding: 11 }}>
            <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
              Add the login password now. You can also set an optional cashier PIN for quick sign-in later.
            </Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Password"
                  value={value}
                  onChangeText={(next) => { setSetupError(null); onChange(next); }}
                  placeholder="Secure password"
                  secureTextEntry
                  error={errors.password?.message}
                  helperText="Choose a password you can remember."
                />
              )}
            />
            <Controller
              control={control}
              name="cashierPin"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Optional cashier PIN"
                  value={value ?? ""}
                  onChangeText={(next) => { setSetupError(null); onChange(next); }}
                  placeholder="1234"
                  keyboardType="number-pad"
                  secureTextEntry
                  error={errors.cashierPin?.message}
                  helperText="Leave blank if you do not need a cashier PIN yet."
                />
              )}
            />
          </Card>
        ) : null}

        {stepIndex === 5 ? (
          <Card style={{ gap: 8, padding: 11 }}>
            <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17 }}>
              Review your business details and security setup before continuing.
            </Text>
            <View style={{ gap: 10 }}>
              <SummaryBlock label="Owner" value={watch("ownerName") || "Not set"} helper={watch("phone") || "No phone added"} />
              <SummaryBlock label="Business" value={watch("businessName") || "Not set"} helper={`${watch("branchName") || "Main branch"} • ${watch("currency") || "KES"}`} />
              <SummaryBlock
                label="Industry"
                value={selectedIndustry.label}
                helper={selectedTypeOption ? `${selectedTypeOption.label} • ${selectedTypeOption.description}` : selectedIndustry.description}
              />
              <SummaryBlock label="Plan" value={formatPlanLabel(selectedPlan)} helper={planDescription(selectedPlan)} />
              <SummaryBlock label="Security" value="Password ready" helper={watch("cashierPin") ? "Cashier PIN included" : "No cashier PIN set"} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {selectedIndustry.dashboard.widgets.map((widget) => (
                <Badge key={widget.key} label={widget.label} tone={widget.tone ?? "primary"} />
              ))}
            </View>
          </Card>
        ) : null}

        {setupError ? <AuthMessage tone="error">{setupError}</AuthMessage> : null}
        <Card style={{ gap: 8, padding: 10, borderRadius: 15 }}>
          {stepIndex > 0 ? (
            <Pressable onPress={() => setStepIndex((current) => Math.max(0, current - 1))} hitSlop={8} style={{ alignSelf: "center", paddingVertical: 2 }}>
              <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, fontWeight: "800" }}>Back</Text>
            </Pressable>
          ) : null}
          {stepIndex < steps.length - 1 ? (
            <PrimaryButton title="Continue" iconRight="arrow-forward" fullWidth onPress={() => void handleAdvance()} />
          ) : (
            <PrimaryButton title="Create owner account" iconRight="arrow-forward" fullWidth loading={loading || submitting} onPress={handleSubmit(submit, onInvalid)} />
          )}
          <Pressable onPress={() => navigation.navigate("Login")} hitSlop={8} style={{ alignSelf: "center", paddingVertical: 2 }}>
            <Text style={{ color: tokens.colors.primaryStrong, fontSize: 12, fontWeight: "800" }}>I already have an account</Text>
          </Pressable>
        </Card>
      </AppScrollView>
      <Modal visible={countryPickerVisible} transparent animationType="slide" onRequestClose={() => setCountryPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: tokens.colors.overlay }}>
          <View style={{ maxHeight: "82%", backgroundColor: tokens.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 15, gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: tokens.colors.text, fontSize: 19, fontWeight: "900" }}>Choose your country</Text>
              <Pressable onPress={() => setCountryPickerVisible(false)}><Text style={{ color: tokens.colors.primaryStrong, fontWeight: "800" }}>Close</Text></Pressable>
            </View>
            <InputField label="Search countries" value={countrySearch} onChangeText={setCountrySearch} placeholder="Kenya, United States..." />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
              {countryOptions
                .filter((option) => `${option.name} ${option.callingCode}`.toLowerCase().includes(countrySearch.toLowerCase()))
                .map((option) => (
                  <Pressable key={option.code} onPress={() => { setCountry(option); clearErrors("phone"); setCountryPickerVisible(false); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: option.code === country.code ? tokens.colors.primaryStrong : tokens.colors.border, backgroundColor: option.code === country.code ? tokens.colors.surfaceAlt : tokens.colors.surface }}>
                    <Text style={{ fontSize: 19 }}>{option.flag}</Text>
                    <Text style={{ flex: 1, color: tokens.colors.text, fontWeight: "800" }}>{option.name}</Text>
                    <Text style={{ color: tokens.colors.textSecondary }}>{option.callingCode}</Text>
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function countryFlag(code: string) {
  return code.toUpperCase().replace(/[A-Z]/g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

function SummaryBlock({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <View style={{ padding: 12, borderRadius: 16, backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border, gap: 4 }}>
      <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{helper}</Text>
    </View>
  );
}

function formatPlanLabel(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function planDescription(plan: string) {
  if (plan === "command") return "A focused starting point for small teams.";
  if (plan === "pro") return "Balanced capacity for growing businesses.";
  if (plan === "elite") return "More room for established teams.";
  if (plan === "enterprise") return "Built for larger operations.";
  return "Choose the plan that fits your current needs.";
}
