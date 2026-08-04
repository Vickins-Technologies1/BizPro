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
  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
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
      <GradientHeader title="Vickins Business OS" subtitle="Internet-first setup for a serious small business" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Card style={{ gap: 14 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "800" }}>Owner setup</Text>
          <Text style={{ color: tokens.colors.textSecondary }}>
            Create the business profile, select the operating model, and secure the device for reliable offline capture when the network drops.
          </Text>
          <Controller
            control={control}
            name="ownerName"
            render={({ field: { value, onChange } }) => <InputField label="Owner name" value={value} onChangeText={onChange} placeholder="John Mwangi" />}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange } }) => <InputField label="Phone" value={value} onChangeText={onChange} placeholder="07..." keyboardType="phone-pad" />}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange } }) => <InputField label="Password" value={value} onChangeText={onChange} placeholder="Secure password" secureTextEntry />}
          />
          <Controller
            control={control}
            name="businessName"
            render={({ field: { value, onChange } }) => <InputField label="Business name" value={value} onChangeText={onChange} placeholder="Vickins Mart" />}
          />
          <Controller
            control={control}
            name="branchName"
            render={({ field: { value, onChange } }) => <InputField label="First branch" value={value} onChangeText={onChange} placeholder="Main shop" />}
          />
          <Controller
            control={control}
            name="currency"
            render={({ field: { value, onChange } }) => <InputField label="Currency" value={value} onChangeText={onChange} placeholder="KES" />}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {businessTypeOptions.map((type) => (
              <Pressable key={type} onPress={() => setValue("businessType", type, { shouldDirty: true, shouldTouch: true })}>
                <Badge label={type.replaceAll("_", " ")} tone={watch("businessType") === type ? "success" : "primary"} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {planOptions.map((plan) => (
              <Pressable key={plan} onPress={() => setValue("planTier", plan, { shouldDirty: true, shouldTouch: true })}>
                <Badge label={`${plan} ${plan === selectedPlan ? "active" : ""}`.trim()} tone={selectedPlan === plan ? "success" : "primary"} />
              </Pressable>
            ))}
          </View>
          <Controller
            control={control}
            name="cashierPin"
            render={({ field: { value, onChange } }) => <InputField label="Optional cashier PIN" value={value ?? ""} onChangeText={onChange} placeholder="1234" keyboardType="number-pad" />}
          />
          <PrimaryButton
            title="Complete setup"
            loading={loading}
            onPress={handleSubmit(
              async (values) => {
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
                }
              },
              (errors) => {
                const firstError = Object.values(errors)[0];
                Alert.alert("Check your details", firstError?.message ?? "Please complete all required fields before continuing.");
              }
            )}
          />
          <PrimaryButton title="Sign in instead" variant="secondary" onPress={() => navigation.navigate("Login")} />
        </Card>
      </ScrollView>
    </Screen>
  );
}
