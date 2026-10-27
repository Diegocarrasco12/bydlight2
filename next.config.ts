import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Imagen Docker minima (ver Dockerfile): genera .next/standalone con server.js.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    // Paginas de ordenes y API: nunca en cache, sin indexar y sin enviar el codigo de la orden como Referer a otros sitios (same-origin: el navegador si envia Origin en sus propios formularios).
    const private_ = [
      { key: "Cache-Control", value: "no-store" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/orden/:path*", headers: private_ },
      { source: "/api/:path*", headers: private_ },
    ];
  },
};

export default nextConfig;
