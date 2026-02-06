const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      resolveAlias: {
        "@react-native-async-storage/async-storage": path.resolve(
          __dirname,
          "shims/async-storage.js"
        ),
        "pino-pretty": path.resolve(
          __dirname,
          "shims/pino-pretty.js"
        ),
      },
    },
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "shims/async-storage.js"
      ),
      "pino-pretty": path.resolve(
        __dirname,
        "shims/pino-pretty.js"
      ),
    };
    return config;
  },
};

module.exports = nextConfig;
