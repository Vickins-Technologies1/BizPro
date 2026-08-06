import React from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { BUSINESS_TYPES, PLAN_TIERS, businessSetupSchema } from "@shared";
import { GradientHeader, InputField, PrimaryButton, Screen, Card, Badge } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { z } from "zod";

type FormValues = z.infer<typeof businessSetupSchema>;

const businessTypeOptions = BUSINESS_TYPES;
const planOptions = PLAN_TIERS;

export function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const loading = useAppStore((state) => state.loading);
  const activateSession = useAppStore((state) => state.activateSession);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const [submitting, setSubmitting] = React.useState(false);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(businessSetupSchema),
    defaultValues: {
      ownerName: "",
      phone: "",
      password: "",
      businessName: "",
      businessType: "retail_shop",
      planTier: "lite",
      currency: "KES",
      branchName: "Main Shop",
      cashierPin: ""
    }
  });
  const selectedPlan = watch("planTier");

  return (
    <Screen hideFooter>
      <GradientHeader title="Biz Pro" subtitle="Set up your business once, then start selling with confidence" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "800" }}>Create your owner account</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            We&apos;ll create the owner login, set up your business profile, and get the first branch ready for daily use.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge label="Owner account" tone="success" />
            <Badge label="Business profile" tone="primary" />
            <Badge label="Offline ready" tone="warning" />
          </View>
        </Card>
        <Card style={{ gap: 14 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Your details</Text>
          <Controller
            control={control}
            name="ownerName"
            render={({ field: { value, onChange } }) => (
              <InputField label="Owner name" value={value} onChangeText={onChange} placeholder="John Mwangi" error={errors.ownerName?.message} helperText="This is the person who owns the business." />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange } }) => (
              <InputField label="Phone" value={value} onChangeText={onChange} placeholder="07..." keyboardType="phone-pad" error={errors.phone?.message} helperText="Use the owner phone number." />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange } }) => (
              <InputField label="Password" value={value} onChangeText={onChange} placeholder="Secure password" secureTextEntry error={errors.password?.message} helperText="Choose a password you can remember." />
            )}
          />
          <Controller
            control={control}
            name="businessName"
            render={({ field: { value, onChange } }) => (
              <InputField label="Business name" value={value} onChangeText={onChange} placeholder="Your business name" error={errors.businessName?.message} helperText="The name customers will see on receipts and reports." />
            )}
          />
          <Controller
            control={control}
            name="branchName"
            render={({ field: { value, onChange } }) => (
              <InputField label="First branch" value={value} onChangeText={onChange} placeholder="Main shop" error={errors.branchName?.message} helperText="You can add more branches later." />
            )}
          />
          <Controller
            control={control}
            name="currency"
            render={({ field: { value, onChange } }) => (
              <InputField label="Currency" value={value} onChangeText={onChange} placeholder="KES" error={errors.currency?.message} helperText="Use a 3-letter code such as KES or UGX." />
            )}
          />
        </Card>
        <Card style={{ gap: 14 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Business details</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {businessTypeOptions.map((type) => (
              <Pressable key={type} onPress={() => setValue("businessType", type, { shouldDirty: true, shouldTouch: true })}>
                <Badge label={formatBusinessTypeLabel(type)} tone={watch("businessType") === type ? "success" : "primary"} />
              </Pressable>
            ))}
          </View>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>
            Pick the operating model that best matches your business. You can adjust the business details later.
          </Text>
          <View style={{ gap: 10 }}>
            <Text style={{ color: tokens.colors.text, fontWeight: "800" }}>Plan</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {planOptions.map((plan) => (
              <Pressable key={plan} onPress={() => setValue("planTier", plan, { shouldDirty: true, shouldTouch: true })}>
                <Badge label={formatPlanLabel(plan)} tone={selectedPlan === plan ? "success" : "primary"} />
              </Pressable>
            ))}
          </View>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18 }}>{planDescription(selectedPlan)}</Text>
          </View>
        </Card>
        <Card style={{ gap: 14 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 18, fontWeight: "800" }}>Security</Text>
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
          <PrimaryButton
            title="Create owner account"
            loading={loading || submitting}
            onPress={handleSubmit(
              async (values) => {
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
                      }
                    }
                  ]);
                } catch (error) {
                  Alert.alert("Setup failed", error instanceof Error ? error.message : "Failed to complete setup");
                } finally {
                  setSubmitting(false);
                }
              },
              (errors) => {
                const firstError = Object.values(errors)[0];
                Alert.alert("Check your details", firstError?.message ?? "Please complete all required fields before continuing.");
              }
            )}
          />
          <PrimaryButton title="I already have an account" variant="secondary" onPress={() => navigation.navigate("Login")} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function formatBusinessTypeLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
