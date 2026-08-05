/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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
