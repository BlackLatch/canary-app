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
  // Disable experimental features that may cause lightningcss issues
  experimental: {
    optimizeCss: false,
  },
  // Make build more permissive for static export
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Disable webpack cache in production builds to avoid deployment issues
    if (process.env.NODE_ENV === 'production') {
      config.cache = false;
    }
    
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

    // Handle lightningcss native module issues in production builds
    if (process.env.NODE_ENV === 'production') {
      config.externals = config.externals || [];
      config.externals.push({
        'lightningcss': 'lightningcss'
      });
      
      // Suppress specific native module warnings
      config.ignoreWarnings = config.ignoreWarnings || [];
      config.ignoreWarnings.push(/lightningcss.*\.node/);
    }

    return config;
  },
}

module.exports = nextConfig 