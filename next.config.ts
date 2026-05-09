import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/api/dict/lookup": ["./node_modules/@patdx/kuromoji/dict/**"],
    "/instrumentation": ["./node_modules/@patdx/kuromoji/dict/**"],
  },
  experimental: {
    proxyClientMaxBodySize: "5gb",
  },
};

export default nextConfig;
