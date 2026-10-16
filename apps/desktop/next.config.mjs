/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    const apiBase = (process.env.DIRA_API_URL || "https://bizpro-server-u6vceulhlq-ww.a.run.app/api").replace(/\/$/, "");
    return [
      { source: "/api", destination: apiBase },
      { source: "/api/:path*", destination: `${apiBase}/:path*` }
    ];
  }
};

export default nextConfig;
