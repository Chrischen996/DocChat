import type { NextConfig } from "next";
import { fileURLToPath } from 'url';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config) => {
    // Add aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      'next-intl': path.resolve('./src/lib/next-intl.js'),
    };
    
    return config;
  },
};

export default nextConfig;
