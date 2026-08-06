declare module "next" {
  export type Metadata = Record<string, unknown>;
}

declare module "next/server" {
  export type NextRequest = Request & {
    headers: Headers;
    method: string;
    url: string;
    text(): Promise<string>;
  };
}

declare module "next/font/google" {
  type FontOptions = {
    subsets?: string[];
    variable?: string;
  };

  type LoadedFont = {
    variable: string;
  };

  export function Manrope(options: FontOptions): LoadedFont;
  export function Space_Grotesk(options: FontOptions): LoadedFont;
}
