/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  transpilePackages: ['@virtuals-protocol/acp-node', '@aa-sdk/core', '@account-kit/infra', '@account-kit/smart-contracts'],
  webpack: (config, { dev, isServer }) => {
    // Fixes for refresh issues
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};
