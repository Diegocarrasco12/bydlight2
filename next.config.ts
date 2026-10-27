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
    // Cache: el HTML SIEMPRE se revalida en el navegador (no-cache = guardar pero preguntar antes de usar).
    // Asi, tras un despliegue nadie ve HTML viejo apuntando a archivos /_next/static que ya no existen (pagina sin
    // estilos). Los archivos con hash de /_next/static los marca Next como immutable; las imagenes propias se
    // cachean un dia.
    const revalidate = [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/((?!_next/|img/|api/|orden).*)", headers: revalidate },
      { source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      { source: "/orden/:path*", headers: private_ },
      { source: "/api/:path*", headers: private_ },
    ];
  },
};

export default nextConfig;
