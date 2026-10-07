import React from "react";
import { Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation, useRoute } from "@react-navigation/native";
import { z } from "zod";
import { InputField, PrimaryButton } from "@/components/Primitives";
import { AuthLink, AuthLayout, AuthMessage, AuthSectionLabel } from "@/components/AuthComponents";
import { resetPassword } from "@/services/apiClient";
import { useThemeTokens } from "@/theme";

const resetSchema = z
  .object({
    identifier: z.string().trim().min(2, "Enter your phone number or account name."),
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit reset code."),
    password: z.string().min(6, "Use at least 6 characters for your new password.").max(128, "Use a shorter password."),
    confirmPassword: z.string().min(1, "Confirm your new password.")
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

type FormValues = z.infer<typeof resetSchema>;

export function ResetPasswordScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const theme = useThemeTokens();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [complete, setComplete] = React.useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(resetSchema),
    defaultValues: {
      identifier: route.params?.identifier ?? "",
      code: route.params?.code ?? "",
      password: "",
      confirmPassword: ""
    }
  });

  if (complete) {
    return (
      <AuthLayout title="Password updated" subtitle="Your Dira OS account is ready for a fresh sign in.">
        <AuthMessage tone="success" icon="checkmark-circle-outline">Your password has been changed securely. The reset code can’t be used again.</AuthMessage>
        <PrimaryButton title="Return to sign in" iconRight="arrow-forward-outline" fullWidth onPress={() => navigation.navigate("Login")} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Use the one-time code you received, then choose a password you’ll remember."
      footer={<AuthLink label="Back to sign in" icon="arrow-back-outline" onPress={() => navigation.navigate("Login")} />}
    >
      <AuthSectionLabel>Secure password reset</AuthSectionLabel>
      <Controller
        control={control}
        name="identifier"
        render={({ field: { value, onChange } }) => (
          <InputField label="Phone or account name" value={value} onChangeText={onChange} placeholder="07… or your account name" error={errors.identifier?.message} autoCapitalize="words" />
        )}
      />
      <Controller
        control={control}
        name="code"
        render={({ field: { value, onChange } }) => (
          <InputField
            label="6-digit reset code"
            value={value}
            onChangeText={(next) => onChange(next.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            error={errors.code?.message}
            helperText="The code expires soon and works only once."
            autoCapitalize="none"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { value, onChange } }) => (
          <InputField label="New password" value={value} onChangeText={onChange} placeholder="At least 6 characters" secureTextEntry error={errors.password?.message} />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { value, onChange } }) => (
          <InputField label="Confirm new password" value={value} onChangeText={onChange} placeholder="Repeat your new password" secureTextEntry error={errors.confirmPassword?.message} />
        )}
      />
      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
      <PrimaryButton title="Reset password" iconRight="checkmark-outline" fullWidth loading={loading} onPress={handleSubmit(submit)} />
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: "center" }}>
          Passwords are encrypted before they are stored and are never shown in the app.
        </Text>
      </View>
    </AuthLayout>
  );

  async function submit(values: FormValues) {
    setLoading(true);
    setError(null);
    try {
      await resetPassword({ identifier: values.identifier.trim(), code: values.code, password: values.password });
      setComplete(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "We couldn’t reset your password. Request a new code and try again.");
    } finally {
      setLoading(false);
    }
  }
}
