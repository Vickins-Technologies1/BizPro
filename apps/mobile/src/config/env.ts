declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };

export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://bizpro-server-u6vceulhlq-ww.a.run.app/api"
} as const;
