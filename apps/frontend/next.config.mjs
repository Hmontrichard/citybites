/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security headers for production
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Only our own scripts
      "script-src 'self'",
      // Next.js injects inline styles; allow inline styles but restrict everything else
      "style-src 'self' 'unsafe-inline'",
      // Leaflet tiles and local assets
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
      // Outbound fetches only to our agent service
      "connect-src 'self' https://citybites.fly.dev",
      // Fonts
      "font-src 'self' data:",
      // Workers (if any)
      "worker-src 'self' blob:",
      // Upgrade any HTTP to HTTPS
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
