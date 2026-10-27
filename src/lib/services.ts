export type Service = {
  slug: string
  line: "web" | "ingenieria"
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
    slug: "desarrollo-web",
    line: "web",
    name: "Desarrollo de páginas web",
    short: "Sitios profesionales, rápidos y listos para ser encontrados en Google.",
    metaTitle: "Desarrollo de páginas web en Chile",
    metaDescription:
      "Creamos páginas web profesionales y rápidas para emprendedores y pymes en Chile: diseño responsive, SEO base, formulario y WhatsApp. Planes desde $149.990 + IVA.",
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
    metaTitle: "Desarrollo de ecommerce y tiendas online en Chile",
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
    name: "Software a medida y sistemas empresariales",
    short: "Sistemas y plataformas diseñados para los procesos reales de tu empresa.",
    metaTitle: "Desarrollo de software a medida y sistemas empresariales en Chile",
    metaDescription:
      "Desarrollamos software a medida, plataformas web y sistemas empresariales para empresas en Chile. Cotización personalizada, por etapas y con arquitectura definida.",
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
    name: "Arquitectura de software y consultoría tecnológica",
    short: "Diseño técnico para que tu plataforma sea escalable, segura y mantenible.",
    metaTitle: "Arquitectura de software y consultoría tecnológica en Chile",
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
    metaTitle: "Desarrollo de aplicaciones móviles con Flutter en Chile",
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
    name: "Integración de sistemas y APIs",
    short: "Conectamos tus sistemas, plataformas y servicios para que los datos fluyan solos.",
    metaTitle: "Integración de sistemas y desarrollo de APIs en Chile",
    metaDescription:
      "Desarrollo de APIs REST e integración con ERP (SAP Business One Service Layer), CRM, facturación, pagos y aplicaciones propias. Autenticación segura, reintentos, registro y documentación. Cotización según alcance.",
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
    name: "Automatización y modernización de procesos",
    short: "Eliminamos tareas manuales y errores con flujos automatizados y sistemas simples.",
    metaTitle: "Automatización de procesos y modernización de sistemas en Chile",
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
