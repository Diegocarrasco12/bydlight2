// Fotografia ilustrativa (Pexels). Nunca representa instalaciones, equipo o clientes de Byd Light Solutions.
// Procedencia y licencia: docs/CREDITOS-RECURSOS.md. Variantes: /img/stock/<file>-640.webp y -1280.webp.
export type Photo = { file: string; alt: string; w: number; h: number }

export const photoSrc = (p: Photo, w: 640 | 1280) => `/img/stock/${p.file}-${w}.webp`
export const photoSrcSet = (p: Photo) => `${photoSrc(p, 640)} 640w, ${photoSrc(p, 1280)} 1280w`

export const PHOTOS = {
  equipo: { file: "equipo-codigo", alt: "Dos desarrolladores revisando código en un monitor", w: 1280, h: 854 },
  desarrollador: { file: "desarrollador-pantallas", alt: "Desarrollador trabajando con dos monitores", w: 1280, h: 960 },
  servidores: { file: "sala-servidores-ti", alt: "Profesional TI frente a racks de red en una sala técnica", w: 1280, h: 854 },
  almacen: { file: "almacen-operacion", alt: "Operarios en un almacén con estanterías, vistos desde arriba", w: 1280, h: 854 },
  tableta: { file: "almacen-tableta", alt: "Persona con una tableta controlando inventario en un almacén", w: 1280, h: 854 },
  red: { file: "modulo-red", alt: "Manos instalando un módulo de red en un equipo", w: 1280, h: 852 },
} satisfies Record<string, Photo>

// Agrupacion para menu, /servicios y footer.
export const SERVICE_GROUPS = [
  { line: "empresa", label: "Soluciones empresariales", blurb: "ERP y plataformas SaaS: desarrollo, personalización e integración." },
  { line: "ingenieria", label: "Software e ingeniería", blurb: "Sistemas a medida, arquitectura, apps, APIs y automatización." },
  { line: "web", label: "Web y ecommerce", blurb: "Sitios y tiendas con alcance y precio definidos." },
] as const

export type ServiceLine = (typeof SERVICE_GROUPS)[number]["line"]

export type Service = {
  slug: string
  line: ServiceLine
  photo?: Photo
  /** Beneficios en lenguaje simple (opcional; se muestran como tarjetas). */
  benefits?: { t: string; d: string }[]
  /** Aclaracion comercial: que es y que no es el servicio (opcional). */
  scopeNote?: string
  name: string
  short: string
  metaTitle: string
  metaDescription: string
  intro: string
  problems: string[]
  deliverables: string[]
  fitsFor: string[]
  faq: { q: string; a: string }[]
  planIds: string[]
}

export const SERVICES: Service[] = [
  {
    slug: "soluciones-erp",
    line: "empresa",
    photo: PHOTOS.tableta,
    name: "Soluciones ERP",
    short: "Integramos, adaptamos y desarrollamos sistemas de gestión: inventario, ventas y operaciones conectados.",
    metaTitle: "Integración ERP y SAP Business One",
    metaDescription:
      "Integración, personalización y desarrollo de sistemas de gestión (ERP) en Chile: inventario, ventas, operaciones y APIs. Experiencia en SAP Business One.",
    intro:
      "Ayudamos a que tu empresa trabaje con un solo flujo de información. Desarrollamos, implementamos, personalizamos e integramos soluciones de gestión empresarial: conectamos el ERP que ya usas con tu sitio, tus aplicaciones y tus procesos, o construimos los módulos que tu operación necesita.",
    scopeNote:
      "Es un servicio de desarrollo, implementación, personalización e integración. No comercializamos un ERP propio: trabajamos sobre la plataforma que tu empresa ya usa o diseñamos módulos a medida para tus procesos.",
    benefits: [
      { t: "Datos que fluyen solos", d: "Menos doble digitación entre tu ERP, tu tienda y tus aplicaciones." },
      { t: "Inventario y ventas al día", d: "Stock, pedidos y documentos sincronizados donde los necesitas." },
      { t: "Procesos a tu medida", d: "Módulos y automatizaciones para lo que un sistema genérico no cubre." },
      { t: "Evolución sin detener la operación", d: "Mejoras por etapas, probadas antes de pasar a producción." },
    ],
    problems: [
      "Tu ERP no se conecta con tu tienda online, tu app o tus otros sistemas.",
      "El inventario y las ventas se actualizan a mano o con planillas.",
      "Necesitas módulos o reportes que el sistema actual no ofrece.",
      "Tu sistema empresarial es antiguo y modernizarlo parece un riesgo para la operación.",
    ],
    deliverables: [
      "Levantamiento del proceso y de los sistemas involucrados",
      "Integración con tu ERP mediante APIs, incluido SAP Business One vía Service Layer",
      "Módulos a medida: inventario, ventas, operaciones y reportes",
      "Automatización de flujos entre plataformas, con registro de cada operación",
      "Pruebas en ambiente de pruebas antes de pasar a producción",
      "Documentación técnica y transferencia al equipo",
    ],
    fitsFor: ["Empresas que ya usan un ERP", "Operaciones con inventario y despacho", "Tiendas online que necesitan sincronizar stock", "Áreas administrativas con procesos manuales"],
    faq: [
      {
        q: "¿Venden un ERP propio?",
        a: "No. Ofrecemos desarrollo, implementación, personalización e integración. Trabajamos sobre tu plataforma actual o construimos módulos a medida para tus procesos.",
      },
      {
        q: "¿Pueden conectar mi ERP con mi tienda o mi aplicación?",
        a: "Sí, si la plataforma expone una API o un mecanismo de integración. Tenemos experiencia técnica con SAP Business One y su Service Layer; evaluamos la factibilidad antes de cotizar.",
      },
      {
        q: "¿Se puede hacer por etapas?",
        a: "Sí. Recomendamos partir por el flujo de mayor impacto, validarlo en uso real y luego extender el alcance.",
      },
    ],
    planIds: ["software"],
  },
  {
    slug: "soluciones-saas",
    line: "empresa",
    photo: PHOTOS.desarrollador,
    name: "Soluciones SaaS",
    short: "Desarrollamos plataformas web multiusuario en la nube, con roles, integraciones y mantenimiento continuo.",
    metaTitle: "Desarrollo de plataformas SaaS en Chile",
    metaDescription:
      "Desarrollo de plataformas SaaS y aplicaciones web empresariales en Chile: sistemas multiusuario, roles y permisos, suscripciones, integraciones y mantenimiento.",
    intro:
      "Si tu idea o tu negocio necesita una plataforma accesible desde cualquier lugar, la diseñamos y la construimos: aplicación web, cuentas de usuario, permisos por rol, integraciones con otros servicios y una base técnica que pueda crecer contigo.",
    scopeNote:
      "Es un servicio de desarrollo de software. Construimos tu plataforma; no ofrecemos un producto SaaS propio ya disponible ni precios por suscripción.",
    benefits: [
      { t: "Acceso desde cualquier lugar", d: "Aplicaciones web que tu equipo y tus clientes usan desde el navegador." },
      { t: "Cada persona ve lo que le corresponde", d: "Múltiples usuarios con roles y permisos bien definidos." },
      { t: "Hecha para crecer", d: "Arquitectura pensada para sumar clientes, módulos y volumen." },
      { t: "Conectada con tus servicios", d: "Pagos, facturación, correo y otras plataformas mediante APIs." },
    ],
    problems: [
      "Quieres lanzar una plataforma propia pero no sabes por dónde empezar.",
      "Tu operación depende de planillas que varias personas editan a la vez.",
      "Necesitas que clientes o socios accedan a información con sus propias cuentas.",
      "Tu aplicación actual no escala o es difícil de mantener.",
    ],
    deliverables: [
      "Definición del alcance y de una primera versión funcional",
      "Aplicación web empresarial con autenticación y gestión de roles y permisos",
      "Modelo multiusuario, y de suscripción si tu negocio lo requiere",
      "Integraciones con servicios externos (pagos, facturación, correo y otros)",
      "Publicación en la nube con respaldos y monitoreo básico",
      "Mantenimiento y evolución posterior, por acuerdo",
    ],
    fitsFor: ["Startups y proyectos propios", "Empresas que digitalizan un proceso", "Instituciones con usuarios externos", "Equipos que reemplazan planillas por una plataforma"],
    faq: [
      {
        q: "¿Tienen una plataforma SaaS lista para contratar?",
        a: "No. Desarrollamos plataformas a medida. Si tienes una idea o un proceso que digitalizar, partimos por definir una primera versión.",
      },
      {
        q: "¿Pueden mantener la plataforma después del lanzamiento?",
        a: "Sí. El mantenimiento y la evolución se acuerdan por separado, con alcance y tiempos de respuesta definidos.",
      },
      {
        q: "¿Cuánto cuesta y cuánto demora?",
        a: "Depende del alcance. Entregamos una cotización con etapas, plazos y entregables después de un levantamiento.",
      },
    ],
    planIds: ["software"],
  },
  {
    slug: "desarrollo-web",
    line: "web",
    name: "Desarrollo de páginas web",
    short: "Sitios profesionales, rápidos y listos para ser encontrados en Google.",
    metaTitle: "Desarrollo de páginas web en Chile",
    metaDescription:
      "Páginas web profesionales y rápidas para emprendedores y pymes en Chile: diseño responsive, SEO base, formulario y WhatsApp. Desde $149.990 + IVA.",
    intro:
      "Diseñamos y desarrollamos sitios web con alcance y precio definidos. Cada plan indica cuántas páginas incluye, cuántas revisiones tiene y qué debes entregar, para que sepas qué recibirás antes de empezar.",
    problems: [
      "No tienes sitio o el actual se ve antiguo y no funciona bien en el celular.",
      "Tus clientes no te encuentran cuando buscan tu servicio.",
      "Recibes consultas dispersas y quieres un canal claro de contacto.",
    ],
    deliverables: [
      "Diseño adaptado a móvil, tablet y escritorio",
      "SEO base: títulos, descripciones, sitemap y datos estructurados según el plan",
      "Formulario de contacto y botón de WhatsApp",
      "Publicación con HTTPS",
    ],
    fitsFor: ["Emprendedores", "Pymes de servicios", "Profesionales independientes", "Negocios locales"],
    faq: [
      {
        q: "¿Cuánto demora hacer una página web?",
        a: "Una landing toma entre 7 y 10 días hábiles y un sitio de varias páginas entre 2 y 5 semanas, contados desde que recibimos el contenido.",
      },
      {
        q: "¿Puedo pedir más páginas después?",
        a: "Sí. Las páginas adicionales se cotizan por separado o puedes pasar a un plan superior.",
      },
    ],
    planIds: ["emprendedor", "profesional", "empresa"],
  },
  {
    slug: "ecommerce",
    line: "web",
    name: "Desarrollo de ecommerce",
    short: "Tienda online con catálogo, carrito y medio de pago para vender desde tu sitio.",
    metaTitle: "Ecommerce y tiendas online en Chile",
    metaDescription:
      "Desarrollamos tiendas online en Chile con catálogo, carrito, panel de administración y pasarela de pago. Plan Ecommerce desde $699.990 + IVA.",
    intro:
      "Una tienda online debe ser simple de comprar y simple de administrar. Construimos el catálogo, el proceso de compra y el panel para que gestiones productos y pedidos sin depender de nadie.",
    problems: [
      "Vendes por redes sociales y WhatsApp y el proceso es manual.",
      "Necesitas aceptar pagos online con una experiencia confiable.",
      "Quieres administrar productos, stock y pedidos desde un solo lugar.",
    ],
    deliverables: [
      "Catálogo con categorías y fichas de producto",
      "Carrito y proceso de compra optimizado para móvil",
      "Integración con un medio de pago acordado",
      "Panel de administración y capacitación",
    ],
    fitsFor: ["Tiendas de retail", "Productores y distribuidores", "Marcas que venden por redes sociales"],
    faq: [
      {
        q: "¿Qué medios de pago se pueden integrar?",
        a: "Se define según tu caso y el proveedor elegido. Las comisiones las cobra el proveedor de pagos, no nosotros.",
      },
      {
        q: "¿Cuántos productos incluye?",
        a: "El plan incluye la carga inicial de hasta 30 productos. Podrás agregar más tú mismo desde el panel.",
      },
    ],
    planIds: ["ecommerce"],
  },
  {
    slug: "software-a-medida",
    line: "ingenieria",
    photo: PHOTOS.equipo,
    name: "Software a medida y sistemas empresariales",
    short: "Sistemas y plataformas diseñados para los procesos reales de tu empresa.",
    metaTitle: "Software a medida en Chile",
    metaDescription:
      "Software a medida, plataformas web y sistemas empresariales para empresas en Chile. Cotización personalizada, por etapas y con arquitectura definida.",
    intro:
      "Cuando una planilla o un sistema genérico ya no alcanza, diseñamos software que se adapta a cómo trabaja tu organización: usuarios, roles, reportes y reglas de negocio propias.",
    problems: [
      "Tu operación depende de planillas, correos y trabajo manual difícil de controlar.",
      "Los sistemas comerciales no se ajustan a tus procesos.",
      "Necesitas trazabilidad, reportes y control por perfiles de usuario.",
    ],
    deliverables: [
      "Levantamiento de requerimientos y alcance por etapas",
      "Diseño de arquitectura y modelo de datos",
      "Desarrollo, pruebas y puesta en marcha",
      "Documentación y transferencia técnica",
    ],
    fitsFor: ["Empresas medianas", "Instituciones educativas", "Operaciones logísticas e industriales"],
    faq: [
      {
        q: "¿Cuánto cuesta un sistema a medida?",
        a: "Depende del alcance. Partimos con un levantamiento y entregamos una cotización con etapas, plazos y entregables.",
      },
      {
        q: "¿Puedo empezar con una parte del sistema?",
        a: "Sí. Recomendamos comenzar con una primera etapa funcional y crecer a partir de lo que se valida en uso real.",
      },
    ],
    planIds: ["software"],
  },
  {
    slug: "arquitectura-de-software",
    line: "ingenieria",
    photo: PHOTOS.servidores,
    name: "Arquitectura de software y consultoría tecnológica",
    short: "Diseño técnico para que tu plataforma sea escalable, segura y mantenible.",
    metaTitle: "Arquitectura de software y consultoría",
    metaDescription:
      "Consultoría y arquitectura de software en Chile: diseño de plataformas escalables, revisión técnica, seguridad y modernización de sistemas existentes.",
    intro:
      "Antes de construir conviene decidir bien. Evaluamos tu situación, definimos la estructura técnica y entregamos un plan claro para construir o modernizar tus sistemas con criterios de seguridad y mantenibilidad.",
    problems: [
      "Tu sistema crece y cada cambio es lento o riesgoso.",
      "No sabes qué tecnología elegir para un proyecto nuevo.",
      "Necesitas una revisión técnica independiente de seguridad o rendimiento.",
    ],
    deliverables: [
      "Diagnóstico técnico y recomendaciones priorizadas",
      "Propuesta de arquitectura y tecnologías",
      "Plan de modernización por etapas",
      "Revisión de seguridad y despliegue",
    ],
    fitsFor: ["Equipos con sistemas existentes", "Empresas que inician un proyecto digital", "Startups"],
    faq: [
      {
        q: "¿Se puede contratar solo la consultoría?",
        a: "Sí. Puedes contratar solo el diagnóstico y la propuesta, y decidir después quién ejecuta el desarrollo.",
      },
      {
        q: "¿Trabajan con sistemas que ya existen?",
        a: "Sí. Revisamos lo existente y proponemos mejoras incrementales sin detener tu operación.",
      },
    ],
    planIds: ["software"],
  },
  {
    slug: "aplicaciones-moviles",
    line: "ingenieria",
    name: "Aplicaciones móviles",
    short: "Apps para Android e iOS con Flutter, conectadas a tus sistemas y APIs.",
    metaTitle: "Apps móviles con Flutter en Chile",
    metaDescription:
      "Desarrollamos aplicaciones móviles para Android e iOS con Flutter, conectadas a APIs y sistemas existentes. Cotización según alcance.",
    intro:
      "Una sola base de código en Flutter para Android e iOS, conectada a tu backend o a tus sistemas mediante APIs. Definimos el alcance antes de cotizar.",
    problems: [
      "Tu equipo en terreno aún registra datos en papel o planillas.",
      "Necesitas una app que consulte o actualice información de tus sistemas.",
      "Quieres ofrecer a tus clientes un canal móvil propio.",
    ],
    deliverables: [
      "Aplicación Flutter para Android e iOS",
      "Conexión con tu backend o ERP mediante APIs REST",
      "Autenticación y control de acceso por usuario",
      "Publicación en las tiendas y documentación técnica",
    ],
    fitsFor: ["Operaciones en terreno", "Empresas con sistemas internos", "Productos digitales propios"],
    faq: [
      {
        q: "¿Se puede conectar la app a mi sistema actual?",
        a: "Sí, si tu sistema expone una API o podemos construirla. Evaluamos la factibilidad antes de cotizar.",
      },
    ],
    planIds: ["software"],
  },
  {
    slug: "integraciones-y-apis",
    line: "ingenieria",
    photo: PHOTOS.red,
    name: "Integración de sistemas y APIs",
    short: "Conectamos tus sistemas, plataformas y servicios para que los datos fluyan solos.",
    metaTitle: "Integración de sistemas y APIs en Chile",
    metaDescription:
      "Desarrollo de APIs REST e integración con ERP (SAP Business One Service Layer), CRM, facturación y pagos. Autenticación segura, registro y documentación.",
    intro:
      "Muchas empresas usan varias herramientas que no se hablan entre sí. Diseñamos APIs e integraciones que conectan tus sistemas, incluido SAP Business One mediante Service Layer, reducen el doble ingreso de datos y dejan registro de lo que ocurre.",
    problems: [
      "Ingresas la misma información en varios sistemas.",
      "Necesitas conectar tu sitio o aplicación con pagos, facturación u otros servicios.",
      "Quieres exponer datos de forma segura a otras aplicaciones.",
    ],
    deliverables: [
      "Análisis de los sistemas a conectar y del flujo de datos",
      "APIs REST con contrato documentado (OpenAPI), versionado y validación de datos",
      "Integración con ERP, entre ellos SAP Business One vía Service Layer (OData, sesiones, lotes)",
      "Autenticación segura y secretos fuera del código",
      "Reintentos con espera progresiva, idempotencia y manejo de errores",
      "Registro de eventos y trazabilidad de cada operación",
      "Pruebas contra un ambiente de pruebas antes de pasar a producción",
      "Documentación técnica",
    ],
    fitsFor: ["Empresas con varios sistemas", "Tiendas online", "Plataformas internas"],
    faq: [
      {
        q: "¿Qué necesito para integrar un servicio de terceros?",
        a: "Acceso a la documentación o a la API del proveedor y credenciales de prueba. Nosotros evaluamos la factibilidad antes de cotizar.",
      },
    ],
    planIds: ["software"],
  },
  {
    slug: "automatizacion-de-procesos",
    line: "ingenieria",
    photo: PHOTOS.almacen,
    name: "Automatización y modernización de procesos",
    short: "Eliminamos tareas manuales y errores con flujos automatizados y sistemas simples.",
    metaTitle: "Automatización de procesos en Chile",
    metaDescription:
      "Automatizamos procesos administrativos y operativos de tu empresa en Chile: reportes, notificaciones, carga de datos y flujos entre sistemas.",
    intro:
      "Identificamos las tareas repetitivas que consumen tiempo y las reemplazamos por automatizaciones confiables: reportes automáticos, avisos, validaciones y traspaso de datos entre sistemas.",
    problems: [
      "Tu equipo dedica horas a tareas repetitivas y propensas a errores.",
      "Los reportes se arman a mano cada semana o cada mes.",
      "Los procesos dependen de una sola persona.",
    ],
    deliverables: [
      "Mapa del proceso actual y oportunidades de mejora",
      "Automatización de los flujos acordados",
      "Pruebas con datos reales",
      "Capacitación al equipo",
    ],
    fitsFor: ["Áreas administrativas", "Operaciones", "Empresas con procesos manuales"],
    faq: [
      {
        q: "¿Qué procesos conviene automatizar primero?",
        a: "Los frecuentes, bien definidos y con reglas claras. En el levantamiento priorizamos por tiempo ahorrado y riesgo.",
      },
    ],
    planIds: ["software"],
  },
  {
    slug: "mantenimiento-web",
    line: "web",
    name: "Mantenimiento web",
    short: "Actualizaciones, respaldos y soporte para que tu sitio siga funcionando bien.",
    metaTitle: "Mantenimiento de sitios web en Chile",
    metaDescription:
      "Planes de mantenimiento web mensual: actualizaciones de seguridad, respaldos, monitoreo y soporte. Desde $19.990 + IVA al mes.",
    intro:
      "Un sitio necesita cuidado continuo. Nuestros planes mensuales cubren actualizaciones, respaldos, monitoreo y pequeños cambios, con alcance y tiempos de respuesta definidos.",
    problems: [
      "Nadie se hace cargo de las actualizaciones y los respaldos.",
      "Necesitas cambios pequeños sin cotizar cada vez.",
      "Quieres saber que tu sitio está disponible y seguro.",
    ],
    deliverables: [
      "Actualizaciones de seguridad",
      "Respaldos periódicos",
      "Monitoreo de disponibilidad",
      "Soporte y cambios menores según el plan",
    ],
    fitsFor: ["Sitios publicados por Byd Light", "Negocios que quieren soporte continuo"],
    faq: [
      {
        q: "¿El mantenimiento incluye el hosting?",
        a: "No. Hosting, dominio y mantenimiento son servicios distintos. Te explicamos cada uno antes de contratar.",
      },
      {
        q: "¿Hay soporte 24/7?",
        a: "No. El soporte es en horario hábil y con los tiempos de respuesta indicados en cada plan.",
      },
    ],
    planIds: [],
  },
]

export function getService(slug: string) {
  return SERVICES.find((s) => s.slug === slug)
}
