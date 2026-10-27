import type { MetadataRoute } from "next"
import { SERVICES } from "@/lib/services"
import { absoluteUrl } from "@/lib/site"

export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/planes", "/servicios", "/proyectos", "/nosotros", "/contacto"]
  return [
    ...pages.map((p) => ({ url: absoluteUrl(p), priority: p === "/" ? 1 : 0.8 })),
    ...SERVICES.map((s) => ({ url: absoluteUrl(`/servicios/${s.slug}`), priority: 0.7 })),
  ]
}
