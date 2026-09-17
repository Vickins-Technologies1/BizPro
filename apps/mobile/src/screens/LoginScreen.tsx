import React from "react";
import { Alert, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { loginSchema } from "@shared";
import { AppScrollView, Card, InputField, PrimaryButton, Screen } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { BrandLogo } from "@/components/BrandLogo";
import { z } from "zod";

type FormValues = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const navigation = useNavigation<any>();
  const authLoading = useAppStore((state) => state.authLoading);
  const login = useAppStore((state) => state.login);
  const [submitting, setSubmitting] = React.useState(false);
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
    <Screen hideFooter>
      <AppScrollView contentContainerStyle={{ gap: 14, paddingTop: 26, paddingBottom: 26 }}>
        <View style={{ alignItems: "center", gap: 8, paddingHorizontal: 20 }}>
          <BrandLogo style={{ width: 92, height: 32 }} />
          <Text style={{ color: tokens.colors.text, fontSize: 23, fontWeight: "900", letterSpacing: -0.5 }}>Welcome back</Text>
          <Text style={{ color: tokens.colors.textSecondary, fontSize: 12, lineHeight: 17, textAlign: "center" }}>Sign in to continue to Dira OS.</Text>
        </View>
        <Card style={{ gap: 12, padding: 14 }}>
          <Controller
            control={control}
            name="identifier"
            render={({ field: { value, onChange } }) => (
              <InputField
                label="Phone or name"
                value={value}
                onChangeText={onChange}
                placeholder="07..."
                error={errors.identifier?.message}
                helperText="Phone number or owner name."
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
                onChangeText={onChange}
                placeholder="••••"
                secureTextEntry
                error={errors.passwordOrPin?.message}
                helperText="Owner password or team PIN."
              />
            )}
          />
          <PrimaryButton
            title="Sign In"
            loading={authLoading || submitting}
            onPress={handleSubmit(async (values) => {
              setSubmitting(true);
              try {
                await login(values);
              } catch (error) {
                Alert.alert("Login failed", error instanceof Error ? error.message : "Invalid credentials");
              } finally {
                setSubmitting(false);
              }
            })}
          />
          <PrimaryButton title="Create owner account" variant="secondary" onPress={() => navigation.navigate("Onboarding")} />
        </Card>
        <Text style={{ color: tokens.colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: "center", paddingHorizontal: 28 }}>New to Dira OS? Set up an owner account with a 30-day free trial.</Text>
      </AppScrollView>
    </Screen>
  );
}
