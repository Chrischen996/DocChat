import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config) => {
    // Add aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      'next-intl': path.resolve('./src/lib/next-intl.ts'),
      'next-intl/plugin': path.resolve('./src/lib/next-intl.ts'),
    };
    
    return config;
  },
};

export default nextConfig;
