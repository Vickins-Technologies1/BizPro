/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@node-rs/argon2"]
  },
  async rewrites() {
    return [
      {
        source: "/api",
        destination: "/api-proxy"
      },
      {
        source: "/api/:path*",
        destination: "/api-proxy/:path*"
      }
    ];
  }
};

export default nextConfig;
