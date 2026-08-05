declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };

export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://bizpro-k625.onrender.com/api"
} as const;
