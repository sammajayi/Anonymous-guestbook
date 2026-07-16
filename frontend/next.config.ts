import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Multiple lockfiles exist above this dir; pin the root so relative aliases
  // and file tracing resolve against the frontend, not an inferred parent.
  outputFileTracingRoot: __dirname,
  turbopack: {
    // Turbopack resolves alias string values relative to the project root, so
    // this must stay a project-relative path — an absolute path gets a "."
    // prepended and fails to resolve.
    resolveAlias: {
      'isomorphic-ws': './src/shims/isomorphic-ws.js',
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      'isomorphic-ws': path.resolve(__dirname, 'src/shims/isomorphic-ws.js'),
    };
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;
