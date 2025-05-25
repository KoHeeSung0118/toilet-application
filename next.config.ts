import path from "path";
import type { NextConfig } from "next";

const nextConfig = {
  /* config options here */
    webpack(config: any) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
    }
    return config
  },
};

export default nextConfig;
