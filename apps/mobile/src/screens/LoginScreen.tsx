import React from "react";
import { Alert, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@shared";
import { GradientHeader, InputField, PrimaryButton, Screen, Card } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
import { z } from "zod";

type FormValues = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const authLoading = useAppStore((state) => state.authLoading);
  const login = useAppStore((state) => state.login);
  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", passwordOrPin: "" }
  });

  return (
    <Screen>
      <GradientHeader title="Welcome back" subtitle="Secure login with owner password or cashier PIN" />
      <View style={{ padding: 16 }}>
        <Card style={{ gap: 14 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "800" }}>Sign in</Text>
          <Controller
            control={control}
            name="identifier"
            render={({ field: { value, onChange } }) => <InputField label="Phone or name" value={value} onChangeText={onChange} placeholder="07..." />}
          />
          <Controller
            control={control}
            name="passwordOrPin"
            render={({ field: { value, onChange } }) => <InputField label="Password or PIN" value={value} onChangeText={onChange} placeholder="••••" secureTextEntry />}
          />
          <PrimaryButton
            title="Login"
            loading={authLoading}
            onPress={handleSubmit(async (values) => {
              try {
                await login(values);
              } catch (error) {
                Alert.alert("Login failed", error instanceof Error ? error.message : "Invalid credentials");
              }
            })}
          />
        </Card>
      </View>
    </Screen>
  );
}
