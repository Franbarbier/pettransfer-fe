import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    middlewareClientMaxBodySize: "250mb",
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
  serverExternalPackages: ["xlsx", "jszip"],
};

export default nextConfig;
