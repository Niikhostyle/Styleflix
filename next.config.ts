import type { NextConfig } from "next";

/**
 * Headers de seguridad en el origen (auditoría veotv.cloud).
 * CSP permisiva en connect/img/media/frame (https:) para no romper
 * embeds Vimeus/YouTube, HLS y Payment Brick de Mercado Pago.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next + MP Brick + hls.js CDN en animeav1-embed
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://www.mercadopago.com https://www.mercadopago.cl https://http2.mlstatic.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://http2.mlstatic.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://http2.mlstatic.com",
      "connect-src 'self' https:",
      "media-src 'self' blob: https:",
      "frame-src 'self' https:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://www.mercadopago.com https://www.mercadopago.cl https://www.mercadopago.com.ar https://www.mercadopago.com.mx",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Imagen Docker más chica (Coolify export falla con node_modules completo)
  output: "standalone",
  poweredByHeader: false,
  // Permite el túnel ngrok en desarrollo (si no, Next bloquea /_next y RSC → Unexpected token '<')
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "*.ngrok.app",
    "unloaded-employed-twisty.ngrok-free.app",
    "unloaded-employed-twisty.ngrok-free.dev",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "cdn.animeav1.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
