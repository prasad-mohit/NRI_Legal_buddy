import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["sql.js"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure sql.js is never bundled by webpack
      const existing = config.externals;
      config.externals = [
        ...(Array.isArray(existing) ? existing : []),
        function (
          { request }: { request?: string },
          callback: (err: null, result?: string) => void
        ) {
          if (request && (request === "sql.js/dist/sql-asm.js" || request === "sql.js")) {
            return callback(null, `commonjs ${request}`);
          }
          callback(null);
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
