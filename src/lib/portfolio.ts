// Portafolio. Solo se declara lo que se pudo comprobar en los sitios publicos (navegando con Playwright)
// o lo que Bydlight construyo (demo propia). Nada de resultados, cifras ni clientes inventados.
// Excluidos a proposito: Logistic Control Center (por indicacion) y, mientras no respondan,
// Tu Farmacia Digital (dominio sin resolver) y Constructora MYD (503) — pendientes de decision.

export type ProjectImage = { src: string; alt: string; width: number; height: number }

export type Project = {
  slug: string
  name: string
  kind: string
  summary: string
  /** Funcionalidades observadas en el sitio publico. */
  verified: string[]
  /** Tecnologias comprobadas en el HTML publico o en el codigo propio. */
  tech: string[]
  url?: string
  images: ProjectImage[]
  featured?: boolean
  /** Si es demostracion propia (no es un proyecto de cliente). */
  demo?: boolean
}

const img = (src: string, alt: string, width = 1200, height = 750): ProjectImage => ({ src, alt, width, height })

export const PROJECTS: Project[] = [
  {
    slug: "only-energy",
    name: "Only Energy SPA",
    kind: "Ecommerce",
    featured: true,
    summary:
      "Tienda online de equipos de energía solar para Chile: catálogo por categorías, fichas de producto con carrito, cotizador y kits solares.",
    verified: [
      "Catálogo por categorías: paneles solares, inversores, baterías, protecciones, cables y estructura",
      "Fichas de producto con precio en CLP, IVA incluido y botón «Agregar al carrito»",
      "Carrito y cuenta de cliente",
      "Cotizador de proyectos y kits solares a medida",
      "Información de despacho, devoluciones y preguntas frecuentes",
      "Contacto directo por WhatsApp",
    ],
    tech: ["Next.js", "React"],
    url: "https://onlyenergyspa.cl/cl",
    images: [
      img("/img/portfolio/only-energy-portada.webp", "Portada de Only Energy con kits y soluciones solares"),
      img("/img/portfolio/only-energy-catalogo.webp", "Catálogo de equipos de energía solar de Only Energy"),
      img("/img/portfolio/only-energy-producto.webp", "Ficha de producto de un inversor con precio y botón de carrito"),
      img("/img/portfolio/only-energy-kits.webp", "Página de kits solares off-grid de Only Energy"),
    ],
  },
  {
    slug: "cft-magallanes",
    name: "Bolsa de Trabajo CFT Magallanes",
    kind: "Plataforma web",
    summary:
      "Plataforma de empleabilidad para conectar estudiantes con empresas: ofertas de prácticas y empleo, registro e ingreso de usuarios.",
    verified: ["Búsqueda de prácticas y empleos", "Ofertas destacadas", "Ingreso y registro de usuarios"],
    tech: [],
    url: "https://bolsadetrabajo.cftdemagallanes.cl/",
    images: [img("/img/portfolio/cft-empleabilidad.webp", "Portada de la bolsa de trabajo del CFT de Magallanes")],
  },
  {
    slug: "ginfet",
    name: "GINFET",
    kind: "Sitio corporativo",
    summary: "Sitio corporativo con presentación de servicios, contacto por WhatsApp y reserva de citas.",
    verified: ["Presentación de servicios", "Botón de contacto por WhatsApp", "Acceso a reserva de citas"],
    tech: [],
    url: "https://ginfet.cl/",
    images: [img("/img/portfolio/ginfet.webp", "Sitio web corporativo de GINFET")],
  },
  {
    slug: "angel-y-eva",
    name: "Angel & Eva",
    kind: "Sitio de servicios",
    summary: "Sitio de peluquería con servicios, reservas y contacto. Desarrollado en colaboración con Teranube España.",
    verified: ["Páginas de servicios", "Acceso a reservas", "Sección de contacto"],
    tech: [],
    url: "https://angelyeva.es/",
    images: [img("/img/portfolio/angel-y-eva.webp", "Sitio web de la peluquería Angel & Eva")],
  },
  {
    slug: "software-escritorio-windows",
    name: "Software de escritorio para Windows",
    kind: "Demostración de capacidades",
    demo: true,
    summary:
      "Aplicación de ejemplo de inventario para Windows, desarrollada por Bydlight para mostrar capacidades en C# y .NET. Usa datos ficticios y no es un proyecto de cliente.",
    verified: [
      "Panel con indicadores, inventario, estados y gráfico de movimiento",
      "Interfaz de escritorio propia con tema oscuro",
      "Datos ficticios, sin conexión a sistemas reales",
    ],
    tech: ["C#", ".NET 8", "Windows Forms"],
    images: [img("/img/portfolio/software-escritorio-demo.webp", "Aplicación de escritorio de inventario para Windows (demostración con datos ficticios)", 1200, 724)],
  },
]

export const FEATURED = PROJECTS.find((p) => p.featured)!
export const OTHERS = PROJECTS.filter((p) => !p.featured && !p.demo)
export const DESKTOP_DEMO = PROJECTS.find((p) => p.demo)!
