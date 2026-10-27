// Planes y precios de referencia (CLP). Fuente unica: la pagina de planes, el home,
// los datos estructurados y el sitemap leen de aqui.
//
// PENDIENTE DE APROBACION ANTES DE PUBLICAR: situacion del IVA (ver PRICE_NOTE).

export const PRICE_NOTE =
  "Valores referenciales en pesos chilenos (CLP). La situación del IVA se confirma en la cotización."

export type Plan = {
  id: string
  name: string
  tagline: string
  priceFrom: number | null // null = cotizacion personalizada
  priceLabel: string
  recommended?: boolean
  cta: string
  limits: {
    pages: string
    responsive: string
    seo: string
    forms: string
    revisions: string
    delivery: string
    support: string
  }
  includes: string[]
  clientProvides: string[]
  excluded: string[]
}

export const PLANS: Plan[] = [
  {
    id: "emprendedor",
    name: "Emprendedor",
    tagline: "Landing page para presentar tu negocio y recibir contactos.",
    priceFrom: 149990,
    priceLabel: "$149.990",
    cta: "Cotizar Emprendedor",
    limits: {
      pages: "1 página (hasta 6 secciones)",
      responsive: "Sí, móvil, tablet y escritorio",
      seo: "SEO básico",
      forms: "1 formulario + botón de WhatsApp",
      revisions: "2 rondas de revisión",
      delivery: "7 a 10 días hábiles",
      support: "15 días de corrección de errores",
    },
    includes: [
      "Diseño profesional con tu logo y colores",
      "Textos y fotos que tú entregues, ordenados y optimizados",
      "Botón de WhatsApp y formulario de contacto",
      "Título, descripción y vista previa para compartir en redes",
      "Publicación del sitio con certificado HTTPS",
    ],
    clientProvides: ["Logo", "Textos e imágenes", "Acceso al dominio (si ya existe)"],
    excluded: [
      "Redacción de textos y fotografía",
      "Hosting y dominio (se cotizan aparte)",
      "Páginas o secciones adicionales",
      "Integraciones, reservas o pagos",
    ],
  },
  {
    id: "profesional",
    name: "Web Profesional",
    tagline: "Sitio de varias páginas para pymes que quieren ser encontradas.",
    priceFrom: 299990,
    priceLabel: "$299.990",
    recommended: true,
    cta: "Cotizar Web Profesional",
    limits: {
      pages: "Hasta 5 páginas",
      responsive: "Sí, diseño adaptado a cada dispositivo",
      seo: "SEO on-page + datos estructurados",
      forms: "Formulario de contacto + WhatsApp + mapa",
      revisions: "2 rondas de revisión",
      delivery: "2 a 3 semanas",
      support: "30 días de corrección de errores",
    },
    includes: [
      "Diseño personalizado con identidad de tu marca",
      "Inicio, servicios, nosotros, contacto y una página adicional",
      "SEO on-page: títulos, descripciones, sitemap y datos estructurados",
      "Formulario de contacto, WhatsApp y mapa de ubicación",
      "Optimización de velocidad e imágenes",
      "Configuración de Google Search Console",
    ],
    clientProvides: ["Logo y manual de marca (si existe)", "Textos e imágenes", "Acceso al dominio"],
    excluded: [
      "Redacción profesional de contenidos",
      "Páginas sobre el límite (cada una se cotiza)",
      "Blog, tienda o zona de clientes",
      "Hosting y dominio",
    ],
  },
  {
    id: "empresa",
    name: "Web Empresa",
    tagline: "Presencia corporativa completa, con blog y SEO técnico.",
    priceFrom: 499990,
    priceLabel: "$499.990",
    cta: "Cotizar Web Empresa",
    limits: {
      pages: "Hasta 10 páginas + blog base",
      responsive: "Sí, con revisión en dispositivos reales",
      seo: "SEO técnico completo",
      forms: "Hasta 3 formularios + WhatsApp",
      revisions: "3 rondas de revisión",
      delivery: "3 a 5 semanas",
      support: "45 días de corrección + 1 hora de capacitación",
    },
    includes: [
      "Todo lo de Web Profesional",
      "Hasta 10 páginas y estructura de blog para publicar artículos",
      "SEO técnico: rendimiento, datos estructurados por página y sitemap",
      "Google Analytics y Search Console configurados",
      "Hasta 3 formularios con distintos destinos",
      "Una sesión de capacitación para administrar el contenido",
    ],
    clientProvides: ["Contenidos y estructura aprobada", "Material gráfico", "Responsable único de aprobaciones"],
    excluded: [
      "Redacción de artículos del blog",
      "Páginas sobre el límite",
      "Multi-idioma, zonas privadas o integraciones a medida",
      "Hosting y dominio",
    ],
  },
  {
    id: "ecommerce",
    name: "Ecommerce",
    tagline: "Tienda online para vender con catálogo, carrito y pago.",
    priceFrom: 699990,
    priceLabel: "$699.990",
    cta: "Cotizar Ecommerce",
    limits: {
      pages: "Tienda + hasta 5 páginas informativas",
      responsive: "Sí, flujo de compra optimizado para móvil",
      seo: "SEO de catálogo y fichas de producto",
      forms: "Contacto + WhatsApp + correos de pedido",
      revisions: "3 rondas de revisión",
      delivery: "5 a 8 semanas",
      support: "60 días de corrección + capacitación de administración",
    },
    includes: [
      "Catálogo con categorías y carga inicial de hasta 30 productos",
      "Carrito y proceso de compra",
      "Integración con 1 medio de pago (según alcance acordado)",
      "Panel básico para administrar productos y pedidos",
      "Correos de confirmación de pedido",
      "Capacitación para administrar la tienda",
    ],
    clientProvides: ["Fotos y fichas de productos", "Cuenta propia en la pasarela de pago", "Políticas de despacho y devolución"],
    excluded: [
      "Comisiones de la pasarela de pago (las cobra el proveedor)",
      "Productos sobre el límite de carga inicial",
      "Integración con ERP, inventario o despachos",
      "Hosting y dominio",
    ],
  },
  {
    id: "software",
    name: "Software a medida",
    tagline: "Sistemas, plataformas e integraciones para tu operación.",
    priceFrom: null,
    priceLabel: "Cotización personalizada",
    cta: "Solicitar cotización",
    limits: {
      pages: "Según alcance",
      responsive: "Según requerimientos",
      seo: "No aplica / según proyecto",
      forms: "Según alcance",
      revisions: "Definidas en el contrato",
      delivery: "Según alcance y etapas",
      support: "Definido en el contrato",
    },
    includes: [
      "Levantamiento y definición de alcance",
      "Diseño de arquitectura y plan por etapas",
      "Desarrollo, pruebas y puesta en marcha",
      "Integraciones con APIs y sistemas existentes",
      "Documentación y transferencia técnica",
    ],
    clientProvides: ["Acceso a los responsables del proceso", "Información de sistemas existentes"],
    excluded: ["Se define en la cotización según cada proyecto"],
  },
]

export type MaintenancePlan = {
  id: string
  name: string
  priceFrom: number
  priceLabel: string
  includes: string[]
  excluded: string[]
}

export const MAINTENANCE: MaintenancePlan[] = [
  {
    id: "basico",
    name: "Mantenimiento Básico",
    priceFrom: 19990,
    priceLabel: "$19.990 / mes",
    includes: [
      "Actualizaciones de seguridad del sitio",
      "Respaldo mensual",
      "Monitoreo de disponibilidad",
      "Soporte por correo, respuesta en hasta 2 días hábiles",
      "1 cambio menor al mes (hasta 30 minutos)",
    ],
    excluded: ["Hosting y dominio", "Nuevas páginas o funciones", "Soporte 24/7"],
  },
  {
    id: "avanzado",
    name: "Mantenimiento Avanzado",
    priceFrom: 39990,
    priceLabel: "$39.990 / mes",
    includes: [
      "Todo lo del plan Básico",
      "Respaldos semanales",
      "Informe mensual de estado y rendimiento",
      "Soporte por correo y WhatsApp, respuesta en hasta 1 día hábil",
      "Hasta 3 cambios menores al mes (2 horas en total)",
      "Revisión SEO técnica trimestral",
    ],
    excluded: ["Hosting y dominio", "Desarrollo de nuevas funciones (se cotiza)", "Disponibilidad 24/7"],
  },
]

export const PLAN_RULES = [
  "Forma de pago: 50% al iniciar y 50% al entregar. En proyectos mayores se acuerdan etapas.",
  "El plazo corre desde que recibimos el contenido, y depende de la rapidez con que se aprueben las revisiones.",
  "Una revisión es un conjunto de cambios consolidados en un solo envío. Cambios adicionales se cotizan por hora.",
  "Hosting, dominio y licencias de terceros se cobran aparte y a nombre del cliente.",
  "El mantenimiento es un servicio opcional y mensual, distinto del desarrollo y del hosting.",
]

export const COMPARISON_ROWS: { label: string; key: keyof Plan["limits"] }[] = [
  { label: "Páginas", key: "pages" },
  { label: "Diseño responsive", key: "responsive" },
  { label: "SEO", key: "seo" },
  { label: "Formularios y WhatsApp", key: "forms" },
  { label: "Revisiones", key: "revisions" },
  { label: "Plazo estimado", key: "delivery" },
  { label: "Soporte posterior", key: "support" },
]

export function planWhatsappMessage(plan: Plan) {
  return `Hola, me interesa el plan ${plan.name} de Byd Light Solutions. Quisiera una cotización.`
}

export const PLANS_FAQ = [
  {
    q: "¿Los precios incluyen hosting y dominio?",
    a: "No. El hosting y el dominio se contratan aparte y quedan a tu nombre. Te orientamos para elegir la opción adecuada según tu proyecto.",
  },
  {
    q: "¿Qué significa «desde»?",
    a: "Es el valor base de cada plan con el alcance descrito. Si necesitas más páginas, funciones o integraciones, te entregamos una cotización con el detalle antes de comenzar.",
  },
  {
    q: "¿Cómo se paga?",
    a: "Normalmente 50% al iniciar y 50% al entregar. En proyectos más grandes acordamos pagos por etapas.",
  },
  {
    q: "¿Qué pasa después de entregar el sitio?",
    a: "Cada plan incluye un período de corrección de errores. Para actualizaciones, respaldos y cambios continuos puedes contratar un plan de mantenimiento opcional.",
  },
  {
    q: "¿Pueden desarrollar algo que no está en los planes?",
    a: "Sí. Los sistemas empresariales, plataformas, APIs y automatizaciones se cotizan según el alcance. Escríbenos y revisamos tu caso.",
  },
]
