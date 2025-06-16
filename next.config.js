/** @type {import('next').NextConfig} */
// Updated: 2025-01-16 - Added graceful webpack polyfill fallbacks for Digital Ocean
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  distDir: 'out',
  images: {
    unoptimized: true
  },
  // Make build more permissive for static export
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // Helper function to safely require modules
    const safeRequire = (moduleName) => {
      try {
        return require.resolve(moduleName);
      } catch (error) {
        console.warn(`Warning: Could not resolve ${moduleName}, skipping polyfill`);
        return false;
      }
    };

    // Handle node modules for browser compatibility
    const fallbacks = {};
    
    // Only add polyfills if the modules are available
    const polyfills = {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      url: 'url',
      zlib: 'browserify-zlib',
      http: 'stream-http',
      https: 'https-browserify',
      assert: 'assert',
      os: 'os-browserify',
      path: 'path-browserify'
    };

    Object.entries(polyfills).forEach(([nodeModule, polyfill]) => {
      const resolved = safeRequire(polyfill);
      if (resolved) {
        fallbacks[nodeModule] = resolved;
      } else {
        fallbacks[nodeModule] = false;
      }
    });

    // Always disable these Node.js modules in browser
    fallbacks.fs = false;
    fallbacks.net = false;
    fallbacks.tls = false;

    config.resolve.fallback = {
      ...config.resolve.fallback,
      ...fallbacks
    };

    // Only add raw-loader rule if raw-loader is available
    const rawLoader = safeRequire('raw-loader');
    if (rawLoader) {
      config.module.rules.push({
        test: /\.node$/,
        use: 'raw-loader',
      });
    }

    return config;
  },
}

module.exports = nextConfig 