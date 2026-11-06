export const SITE = {
  name: "Byd Light Solutions",
  shortName: "Bydlight",
  url: "https://bydlightsolutions.com",
  email: "bydlightsolutions@gmail.com", // correo oficial aprobado por el titular (2026-11-06)
  whatsappNumber: "56983249135",
  whatsappDisplay: "+56 9 8324 9135",
  country: "CL",
  logo: "/img/logos/logo2-512.png",
  logoSmall: "/img/logos/logo2-sm.png",
  description:
    "Desarrollo de páginas web, ecommerce, software a medida y arquitectura de software para emprendedores, pymes y empresas en Chile.",
} as const

export function whatsappLink(message: string) {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(message)}`
}

export function absoluteUrl(path = "/") {
  return `${SITE.url}${path === "/" ? "" : path}`
}
