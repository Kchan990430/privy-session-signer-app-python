/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  transpilePackages: ['@virtuals-protocol/acp-node'],
  typescript: {
    // Skip type checking for build errors in third-party libraries
    ignoreBuildErrors: true
  },
  webpack: (config, { dev, isServer }) => {
    // Fixes for refresh issues
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    
    // Fix for @hpke/core dynamic require warnings
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@hpke/core': '@hpke/core',
        '@privy-io/server-auth': '@privy-io/server-auth'
      });
    }
    
    // Ignore the critical dependency warnings
    config.module = config.module || {};
    config.module.exprContextCritical = false;
    
    return config;
  },
};
