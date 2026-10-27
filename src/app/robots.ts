import type { MetadataRoute } from "next"
import { absoluteUrl } from "@/lib/site"

export const dynamic = "force-static"

// Sitio publico y estatico: se permite el rastreo general. Las reglas para crawlers de IA
// especificos se deciden aparte (ver propuesta) antes de agregarlas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
  }
}
