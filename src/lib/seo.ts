import type { Metadata } from "next"
import { SITE, absoluteUrl } from "./site"

const OG_IMAGE = { url: "/og-image.png", width: 1200, height: 630, alt: "Byd Light Solutions: desarrollo web y software a medida en Chile" }

/**
 * Metadatos completos de una pagina. Next no hereda `openGraph` de forma parcial (lo reemplaza),
 * asi que cada pagina declara aqui url, titulo, descripcion, imagen, sitio e idioma.
 * `title` va sin la marca: la plantilla del layout agrega " | Byd Light Solutions".
 */
export function pageMetadata({ title, description, path, ogTitle }: { title: string; description: string; path: string; ogTitle?: string }): Metadata {
  const shown = ogTitle ?? `${title} | ${SITE.name}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "es_CL", siteName: SITE.name, url: path, title: shown, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: shown, description, images: [OG_IMAGE.url] },
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Inicio", path: "/" }, ...items].map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  }
}
