import path from "path";
import type { NextConfig } from "next";

const nextConfig = {
  /* config options here */
    webpack(config: NextConfig) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
    }
    return config
  },
};

export default nextConfig;
