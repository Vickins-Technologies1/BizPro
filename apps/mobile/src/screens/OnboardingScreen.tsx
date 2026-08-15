import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { PLAN_TIERS, businessSetupSchema, listIndustryModules, resolveIndustryModule } from "@shared";
import { AppScrollView, Badge, Card, GradientHeader, InputField, PrimaryButton, Screen } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { z } from "zod";

type FormValues = z.infer<typeof businessSetupSchema>;
type SetupStepKey = "business" | "industry" | "type" | "plan" | "security" | "finish";

const industryModules = listIndustryModules();
const defaultIndustry = industryModules[0]!;
const defaultIndustryKey = defaultIndustry?.key ?? "retail";
const defaultBusinessType = defaultIndustry?.businessTypes[0]?.value ?? "retail_shop";
const planOptions = PLAN_TIERS;

const steps: Array<{ key: SetupStepKey; title: string; subtitle: string }> = [
  { key: "business", title: "Business Information", subtitle: "Owner details and the core business profile." },
  { key: "industry", title: "Industry", subtitle: "Choose the industry your business belongs to." },
  { key: "type", title: "Business Type", subtitle: "Pick the operating style that fits the selected industry." },
  { key: "plan", title: "Subscription Plan", subtitle: "Select the starting subscription for this business." },
  { key: "security", title: "Security", subtitle: "Set the password and optional cashier PIN." },
  { key: "finish", title: "Finish", subtitle: "Review everything before creating the account." },
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
  const {
    control,
    handleSubmit,
    trigger,
    watch,
    setValue,
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
      planTier: "lite",
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
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submit(values: FormValues) {
    setSubmitting(true);
    try {
      const result = await completeOnboarding(values);
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
      Alert.alert("Setup failed", error instanceof Error ? error.message : "Failed to complete setup");
    } finally {
      setSubmitting(false);
    }
  }

  function onInvalid() {
    const firstError = Object.values(errors)[0];
    Alert.alert("Check your details", firstError?.message ?? "Please complete all required fields before continuing.");
  }

  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <Screen hideFooter>
      <GradientHeader title="Biz Pro" subtitle="A guided setup flow for a new business" />
      <AppScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "800" }}>{activeStep.title}</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>{activeStep.subtitle}</Text>
            </View>
            <Badge label={`Step ${stepIndex + 1} of ${steps.length}`} tone="primary" />
          </View>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: tokens.colors.surfaceAlt, overflow: "hidden" }}>
            <View style={{ width: `${progress}%`, height: "100%", borderRadius: 999, backgroundColor: tokens.colors.success }} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {steps.map((step, index) => (
              <Badge
                key={step.key}
                label={`${index + 1}. ${step.title}`}
                tone={index === stepIndex ? "success" : index < stepIndex ? "primary" : "warning"}
              />
            ))}
          </View>
        </Card>

        {stepIndex === 0 ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Business information</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              We&apos;ll create the owner login, set up the business profile, and prepare the first branch for daily operations.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Badge label="Owner account" tone="success" />
              <Badge label="Business profile" tone="primary" />
              <Badge label="Offline ready" tone="warning" />
            </View>
            <Controller
              control={control}
              name="ownerName"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Owner name"
                  value={value}
                  onChangeText={onChange}
                  placeholder="John Mwangi"
                  error={errors.ownerName?.message}
                  helperText="This is the person who owns the business."
                />
              )}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Phone"
                  value={value}
                  onChangeText={onChange}
                  placeholder="07..."
                  keyboardType="phone-pad"
                  error={errors.phone?.message}
                  helperText="Use the owner phone number."
                />
              )}
            />
            <Controller
              control={control}
              name="businessName"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Business name"
                  value={value}
                  onChangeText={onChange}
                  placeholder="Your business name"
                  error={errors.businessName?.message}
                  helperText="The name customers will see on receipts and reports."
                />
              )}
            />
            <Controller
              control={control}
              name="branchName"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="First branch"
                  value={value}
                  onChangeText={onChange}
                  placeholder="Main shop"
                  error={errors.branchName?.message}
                  helperText="You can add more branches later."
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
                  onChangeText={onChange}
                  placeholder="KES"
                  error={errors.currency?.message}
                  helperText="Use a 3-letter code such as KES or UGX."
                />
              )}
            />
          </Card>
        ) : null}

        {stepIndex === 1 ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Industry</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              Choose the industry that best matches the business. The rest of the setup will adapt to that selection.
            </Text>
            <View style={{ gap: 10 }}>
              {industryModules.map((module) => {
                const selected = module.key === selectedIndustry.key;
                return (
                  <Pressable
                    key={module.key}
                    onPress={() => {
                      setValue("industryKey", module.key, { shouldDirty: true, shouldTouch: true });
                      setValue("businessType", module.businessTypes[0]!.value, { shouldDirty: true, shouldTouch: true });
                    }}
                    style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                  >
                    <Card
                      style={{
                        gap: 10,
                        borderWidth: 1,
                        borderColor: selected ? tokens.colors.success : tokens.colors.border,
                        backgroundColor: selected ? "rgba(34, 197, 94, 0.10)" : tokens.colors.surfaceAlt,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{module.label}</Text>
                          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{module.description}</Text>
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
          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Business type</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              We&apos;ll tailor the workspace to the selected industry. Pick the type that best describes how the business operates.
            </Text>
            <View style={{ padding: 12, borderRadius: 16, backgroundColor: tokens.colors.surfaceAlt, borderWidth: 1, borderColor: tokens.colors.border, gap: 4 }}>
              <Text style={{ color: tokens.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11 }}>Selected industry</Text>
              <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{selectedIndustry.label}</Text>
              <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{selectedIndustry.dashboard.summary}</Text>
            </View>
            <View style={{ gap: 10 }}>
              {businessTypeOptions.map((option) => {
                const selected = selectedBusinessType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setValue("businessType", option.value, { shouldDirty: true, shouldTouch: true })}
                    style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                  >
                    <Card
                      style={{
                        gap: 8,
                        borderWidth: 1,
                        borderColor: selected ? tokens.colors.primaryStrong : tokens.colors.border,
                        backgroundColor: selected ? "rgba(37, 99, 235, 0.12)" : tokens.colors.surfaceAlt,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ color: tokens.colors.text, fontSize: 15, fontWeight: "800" }}>{option.label}</Text>
                          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{option.description}</Text>
                        </View>
                        <Badge label={selected ? "Chosen" : "Pick"} tone={selected ? "success" : "primary"} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        {stepIndex === 3 ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Subscription plan</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              Start small, then upgrade when the business needs more capacity.
            </Text>
            <View style={{ gap: 10 }}>
              {planOptions.map((plan) => {
                const selected = selectedPlan === plan;
                return (
                  <Pressable
                    key={plan}
                    onPress={() => setValue("planTier", plan, { shouldDirty: true, shouldTouch: true })}
                    style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                  >
                    <Card
                      style={{
                        gap: 8,
                        borderWidth: 1,
                        borderColor: selected ? tokens.colors.success : tokens.colors.border,
                        backgroundColor: selected ? "rgba(34, 197, 94, 0.10)" : tokens.colors.surfaceAlt,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>{formatPlanLabel(plan)}</Text>
                          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{planDescription(plan)}</Text>
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
          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Security</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              Add the login password now. You can also set an optional cashier PIN for quick sign-in later.
            </Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { value, onChange } }) => (
                <InputField
                  label="Password"
                  value={value}
                  onChangeText={onChange}
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
                  onChangeText={onChange}
                  placeholder="1234"
                  keyboardType="number-pad"
                  error={errors.cashierPin?.message}
                  helperText="Leave blank if you do not need a cashier PIN yet."
                />
              )}
            />
          </Card>
        ) : null}

        {stepIndex === 5 ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Finish</Text>
            <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
              Review the setup below. Everything from the current flow is still included, only reorganized into a guided experience.
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

        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                title={stepIndex === 0 ? "Continue" : "Back"}
                variant={stepIndex === 0 ? "primary" : "secondary"}
                onPress={() => {
                  if (stepIndex === 0) {
                    void handleAdvance();
                    return;
                  }
                  setStepIndex((current) => Math.max(0, current - 1));
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              {stepIndex < steps.length - 1 ? (
                <PrimaryButton title="Next" onPress={() => void handleAdvance()} />
              ) : (
                <PrimaryButton title="Create owner account" loading={loading || submitting} onPress={handleSubmit(submit, onInvalid)} />
              )}
            </View>
          </View>
          <PrimaryButton title="I already have an account" variant="secondary" onPress={() => navigation.navigate("Login")} />
        </Card>
      </AppScrollView>
    </Screen>
  );
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
  if (plan === "lite") return "A simple starting point for small teams.";
  if (plan === "standard") return "Balanced features for growing businesses.";
  if (plan === "pro") return "Best for businesses that want the full toolkit.";
  return "Choose the plan that fits your current needs.";
}
