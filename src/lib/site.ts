export const SITE = {
  name: "Byd Light Solutions",
  shortName: "Bydlight",
  url: "https://bydlightsolutions.com",
  email: "contacto@bydlightsolutions.com",
  whatsappNumber: "56983249135",
  whatsappDisplay: "+56 9 8324 9135",
  country: "CL",
  logo: "/img/logos/logo2.png",
  description:
    "Desarrollo de páginas web, ecommerce, software a medida y arquitectura de software para emprendedores, pymes y empresas en Chile.",
} as const

export function whatsappLink(message: string) {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(message)}`
}

export function absoluteUrl(path = "/") {
  return `${SITE.url}${path === "/" ? "" : path}`
}
