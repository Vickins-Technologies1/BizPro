import React from "react";
import { Alert, Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { loginSchema } from "@shared";
import { AppScrollView, Badge, Card, GradientHeader, InputField, PrimaryButton, Screen } from "@/components/Primitives";
import { tokens } from "@/theme/tokens";
import { useAppStore } from "@/store/useAppStore";
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
      <GradientHeader title="Welcome back" subtitle="Sign in with the owner password or a cashier PIN" />
      <AppScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        <Card style={{ gap: 12 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "800" }}>Biz Pro login</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            Enter the phone number or owner name tied to the business, then use the password or PIN your team was given.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge label="Simple access" tone="success" />
            <Badge label="Offline ready" tone="primary" />
            <Badge label="Secure sign in" tone="warning" />
          </View>
        </Card>
        <Card style={{ gap: 14 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 20, fontWeight: "800" }}>Sign in</Text>
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
        <Card style={{ gap: 10 }}>
          <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>Need access?</Text>
          <Text style={{ color: tokens.colors.textSecondary, lineHeight: 20 }}>
            New businesses should create the owner account first. Team members can sign in only after the owner adds their employee profile.
          </Text>
        </Card>
      </AppScrollView>
    </Screen>
  );
}
