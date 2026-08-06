import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
