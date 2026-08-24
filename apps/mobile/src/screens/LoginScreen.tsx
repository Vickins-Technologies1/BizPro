import React from "react";
import { Alert, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { loginSchema } from "@shared";
import { AppScrollView, Badge, Card, GradientHeader, InputField, PrimaryButton, Screen } from "@/components/Primitives";
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
      <GradientHeader title="Welcome back" subtitle="Your business, ready when you are" />
      <AppScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 18 }}>
          <BrandLogo style={{ width: 118, height: 40 }} />
          <Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "900" }}>Sign in to BizPro</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 18, textAlign: "center", fontSize: 12 }}>Use your owner password or team PIN to continue.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            <Badge label="Offline ready" tone="primary" />
            <Badge label="Secure access" tone="success" />
          </View>
        </Card>
        <Card style={{ gap: 14 }}>
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
                helperText="Use the phone number or owner name tied to the business."
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
                helperText="Enter the owner password or the cashier PIN."
              />
            )}
          />
          <PrimaryButton
            title="Sign in"
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
        <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20, textAlign: "center", paddingHorizontal: 20 }}>New to BizPro? Create an owner account and get 30 days free with no card required.</Text>
      </AppScrollView>
    </Screen>
  );
}
