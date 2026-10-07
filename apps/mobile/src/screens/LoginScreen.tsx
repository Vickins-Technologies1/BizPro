import React from "react";
import { Pressable, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { loginSchema } from "@shared";
import { InputField, PrimaryButton } from "@/components/Primitives";
import { AuthLink, AuthLayout, AuthMessage, AuthSectionLabel } from "@/components/AuthComponents";
import { useThemeTokens } from "@/theme";
import { useAppStore } from "@/store/useAppStore";
import { z } from "zod";

type FormValues = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const theme = useThemeTokens();
  const authLoading = useAppStore((state) => state.authLoading);
  const login = useAppStore((state) => state.login);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", passwordOrPin: "" }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where your team left off."
      footer={
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>New to Dira OS?</Text>
          <AuthLink label="Create an owner account" onPress={() => navigation.navigate("Onboarding")} />
        </View>
      }
    >
      <AuthSectionLabel>Secure workspace sign in</AuthSectionLabel>
      <Controller
        control={control}
        name="identifier"
        render={({ field: { value, onChange } }) => (
          <InputField
            label="Phone or account name"
            value={value}
            onChangeText={(next) => {
              setSubmitError(null);
              onChange(next);
            }}
            placeholder="07… or your account name"
            error={errors.identifier?.message}
            helperText="Use the same phone number or name you used during setup."
            autoCapitalize="words"
            returnKeyType="next"
          />
        )}
      />
      <Controller
        control={control}
        name="passwordOrPin"
        render={({ field: { value, onChange } }) => (
          <InputField
            label="Password or PIN"
            value={value}
            onChangeText={(next) => {
              setSubmitError(null);
              onChange(next);
            }}
            placeholder="Enter your password"
            secureTextEntry
            error={errors.passwordOrPin?.message}
            helperText="Your password stays private on this device."
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit(submit)()}
          />
        )}
      />

      <View style={{ alignItems: "flex-end", marginTop: -3 }}>
        <Pressable onPress={() => navigation.navigate("ForgotPassword")} accessibilityRole="link" hitSlop={8}>
          <Text style={{ color: theme.colors.primaryStrong, fontSize: 12, fontWeight: "800" }}>Forgot password?</Text>
        </Pressable>
      </View>

      {submitError ? <AuthMessage tone="error">{submitError}</AuthMessage> : null}

      <PrimaryButton title="Sign in" iconRight="arrow-forward-outline" fullWidth loading={authLoading} onPress={handleSubmit(submit)} />
    </AuthLayout>
  );

  async function submit(values: FormValues) {
    setSubmitError(null);
    try {
      await login(values);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "We could not sign you in. Check your details and try again.");
    }
  }
}
