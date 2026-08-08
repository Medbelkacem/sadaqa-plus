import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle for the Docker runtime stage.
  // Harmless on Vercel, which uses its own output tracing.
  output: 'standalone',

  reactStrictMode: true,

  // The build must fail on a type error. Next 16 no longer runs ESLint during
  // `next build`, so `npm run lint` is a separate CI gate (see .github/workflows).
  typescript: { ignoreBuildErrors: false },

  poweredByHeader: false,

  images: {
    // User uploads are served through /api/files/[id], which enforces
    // authorization; nothing is fetched from an arbitrary remote host.
    remotePatterns: [],
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    // Import only the icons actually used rather than the whole set.
    optimizePackageImports: ['lucide-react', 'date-fns', '@radix-ui/react-icons'],
  },

  async headers() {
    return [
      {
        // Belt-and-braces alongside the proxy: static assets are immutable and
        // must never be re-fetched.
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/sw.js',
        headers: [
          // The worker itself must never be cached, or a bad deploy sticks.
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
