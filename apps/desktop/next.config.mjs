/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api", destination: "https://bizpro-server-u6vceulhlq-ww.a.run.app/api" },
      { source: "/api/:path*", destination: "https://bizpro-server-u6vceulhlq-ww.a.run.app/api/:path*" }
    ];
  }
};

export default nextConfig;
