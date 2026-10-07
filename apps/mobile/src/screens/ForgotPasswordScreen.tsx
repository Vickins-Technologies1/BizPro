import React from "react";
import { Text, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigation } from "@react-navigation/native";
import { z } from "zod";
import { InputField, PrimaryButton } from "@/components/Primitives";
import { AuthLink, AuthLayout, AuthMessage, AuthSectionLabel } from "@/components/AuthComponents";
import { requestPasswordReset } from "@/services/apiClient";
import { useThemeTokens } from "@/theme";

const forgotSchema = z.object({ identifier: z.string().trim().min(2, "Enter your phone number or account name.") });
type FormValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const theme = useThemeTokens();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [identifier, setIdentifier] = React.useState("");
  const [debugCode, setDebugCode] = React.useState<string | undefined>();
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    mode: "onTouched",
    resolver: zodResolver(forgotSchema),
    defaultValues: { identifier: "" }
  });

  if (sent) {
    return (
      <AuthLayout title="Check your messages" subtitle="If the account matches, a one-time reset code is on its way.">
        <AuthMessage tone="success" icon="paper-plane-outline">
          We keep this confirmation neutral for your security. Check the contact method linked to your Dira OS account.
        </AuthMessage>
        {debugCode ? <AuthMessage tone="info">Local testing code: {debugCode}</AuthMessage> : null}
        <PrimaryButton
          title="Enter reset code"
          iconRight="arrow-forward-outline"
          fullWidth
          onPress={() => navigation.navigate("ResetPassword", { identifier, code: debugCode })}
        />
        <AuthLink label="Back to sign in" icon="arrow-back-outline" onPress={() => navigation.navigate("Login")} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter the phone number or account name you use to sign in."
      footer={<AuthLink label="Back to sign in" icon="arrow-back-outline" onPress={() => navigation.navigate("Login")} />}
    >
      <AuthSectionLabel>Password recovery</AuthSectionLabel>
      <Controller
        control={control}
        name="identifier"
        render={({ field: { value, onChange } }) => (
          <InputField
            label="Phone or account name"
            value={value}
            onChangeText={(next) => {
              setError(null);
              onChange(next);
            }}
            placeholder="07… or your account name"
            error={errors.identifier?.message}
            helperText="We’ll only reveal the next step, never whether an account exists."
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit(submit)()}
          />
        )}
      />
      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
      <PrimaryButton title="Send reset code" iconRight="paper-plane-outline" fullWidth loading={loading} onPress={handleSubmit(submit)} />
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 11, textAlign: "center", lineHeight: 16 }}>
          Reset codes expire quickly and can only be used once.
        </Text>
      </View>
    </AuthLayout>
  );

  async function submit(values: FormValues) {
    setLoading(true);
    setError(null);
    try {
      const result = await requestPasswordReset(values.identifier);
      setIdentifier(values.identifier.trim());
      setDebugCode(result.debugCode);
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t start password recovery. Try again.");
    } finally {
      setLoading(false);
    }
  }
}
