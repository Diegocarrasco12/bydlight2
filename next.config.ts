import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen Docker minima (ver Dockerfile): genera .next/standalone con server.js.
  output: "standalone",
};

export default nextConfig;
