// Contenido comercial adicional por servicio (enfoque tecnico, datos para cotizar, preguntas utiles, enlaces internos).
// Solo describe capacidades declaradas por el titular; sin clientes, cifras, certificaciones ni alianzas.
export type ServiceExtra = {
  approach: string[]
  quoteInfo: string[]
  faqMore: { q: string; a: string }[]
  related: string[]
}

export const SERVICE_STEPS: [string, string][] = [
  ["Levantamiento", "Reunión para entender el proceso, los sistemas involucrados y qué resultado necesitas. Termina en un alcance escrito."],
  ["Propuesta", "Cotización con etapas, plazos y entregables. Partimos por la etapa de mayor impacto."],
  ["Construcción", "Entregas parciales con revisión tuya, en un ambiente de pruebas separado de producción."],
  ["Puesta en marcha", "Publicación, capacitación básica y documentación técnica para tu equipo."],
  ["Mejora continua", "Soporte y evolución por acuerdo, con alcance y tiempos de respuesta definidos."],
]

export const SERVICE_EXTRAS: Record<string, ServiceExtra> = {
  "soluciones-erp": {
    approach: [
      "Integración con SAP Business One mediante su Service Layer (API REST/OData): sesiones, lotes y manejo de errores. Es una capacidad técnica de integración; no somos partner ni revendedor de SAP.",
      "Capa intermedia propia entre tu ERP y tus canales (sitio, tienda, app), para no depender de planillas ni de procesos manuales.",
      "Pruebas contra un ambiente de pruebas del ERP antes de tocar datos reales, y registro de cada operación para poder auditarla.",
      "Si tu ERP emite documentos tributarios electrónicos, revisamos con tu proveedor de facturación cómo se relaciona el documento del ERP con el folio autorizado, antes de integrar.",
    ],
    quoteInfo: [
      "Qué ERP usas, su versión y si tiene API o ambiente de pruebas.",
      "Qué datos deben viajar (productos, stock, precios, clientes, pedidos, documentos) y en qué dirección.",
      "Con qué frecuencia deben sincronizarse y qué volumen manejas aproximadamente.",
      "Quién administra el ERP en tu empresa o quién es tu proveedor de soporte.",
    ],
    faqMore: [
      { q: "¿Conviene un ERP a medida o uno estándar?", a: "Para la mayoría de los procesos de una pyme suele bastar un ERP estándar. Un desarrollo a medida tiene sentido cuando un proceso es lo que te diferencia y ningún sistema lo cubre bien. Muchas veces la mejor opción es mantener tu ERP y construir solo lo que le falta." },
      { q: "¿Qué necesito para integrar mi ERP con mi tienda online?", a: "Que el ERP exponga una API o un mecanismo de integración, acceso a un ambiente de pruebas y claridad sobre qué datos deben sincronizarse. Con eso evaluamos la factibilidad y cotizamos." },
    ],
    related: ["integraciones-y-apis", "software-a-medida", "ecommerce"],
  },
  "soluciones-saas": {
    approach: [
      "Aplicaciones web con Next.js, React y TypeScript, y servicios con Node.js u otras tecnologías según el caso.",
      "Modelo multiusuario con autenticación, roles y permisos desde el diseño, no como parche posterior.",
      "Bases de datos relacionales (PostgreSQL o MySQL), respaldos y publicación en contenedores Docker.",
      "Primera versión acotada que se valida con usuarios reales antes de ampliar funciones.",
    ],
    quoteInfo: [
      "Qué problema resuelve la plataforma y quiénes la usarán (internos, clientes, socios).",
      "Roles de usuario y qué debe poder hacer cada uno.",
      "Servicios externos a conectar: pagos, facturación, correo, mensajería.",
      "Si habrá cobro por suscripción u otro modelo comercial, y fechas objetivo.",
    ],
    faqMore: [
      { q: "¿Software a medida o SaaS: cuál me conviene?", a: "Un SaaS existente sirve cuando tu proceso es estándar y quieres partir rápido. Una plataforma propia conviene si tu proceso es distinto, necesitas integraciones específicas o la plataforma es parte de tu producto. Podemos revisar tu caso antes de que decidas." },
    ],
    related: ["software-a-medida", "arquitectura-de-software", "integraciones-y-apis"],
  },
  "software-a-medida": {
    approach: [
      "Diseño de arquitectura y modelo de datos antes de programar, para que el sistema pueda crecer sin reescribirse.",
      "Tecnologías según el caso: TypeScript, Node.js, .NET, Java con Spring Boot, Python o PHP, con bases de datos PostgreSQL, MySQL o SQL Server.",
      "Entregas por etapas, con pruebas y un ambiente separado de producción.",
      "Código y documentación entregables a tu equipo: no quedas dependiendo de un solo proveedor.",
    ],
    quoteInfo: [
      "Cómo se hace hoy el proceso (planillas, correos, otro sistema) y dónde se pierde tiempo.",
      "Quiénes lo usarán y qué reportes o controles necesitas.",
      "Sistemas con los que debe conectarse.",
      "Prioridades: qué debe estar en la primera etapa y qué puede esperar.",
    ],
    faqMore: [
      { q: "¿Cuánto cuesta desarrollar software a medida en Chile?", a: "No hay un precio único: depende de la cantidad de procesos, usuarios, reglas e integraciones. Por eso partimos con un levantamiento y entregamos una cotización con etapas. Desconfía de valores cerrados sin conocer tu proceso." },
      { q: "¿El código queda en mi poder?", a: "Se acuerda al cotizar. Entregamos documentación técnica y transferencia al equipo para que no dependas de un único proveedor." },
    ],
    related: ["soluciones-erp", "soluciones-saas", "arquitectura-de-software"],
  },
  "integraciones-y-apis": {
    approach: [
      "APIs REST con contrato documentado (OpenAPI), versionado y validación de datos de entrada.",
      "SAP Business One vía Service Layer (OData, sesiones, lotes) como capacidad de integración; sin atribuirnos relación comercial con SAP.",
      "Autenticación segura, secretos fuera del código, reintentos con espera progresiva e idempotencia para no duplicar operaciones.",
      "Registro de eventos para saber qué se sincronizó, cuándo y qué falló.",
    ],
    quoteInfo: [
      "Los sistemas a conectar y la documentación o API de cada uno.",
      "Credenciales de prueba (nunca de producción) para validar la factibilidad.",
      "Qué dato manda cuando hay diferencias entre sistemas.",
      "Volumen y frecuencia de la sincronización.",
    ],
    faqMore: [
      { q: "¿Pueden integrar sistemas que no tienen API?", a: "A veces. Depende del sistema: puede haber exportaciones, base de datos accesible u otro mecanismo. Lo evaluamos antes de cotizar y te decimos con franqueza si no es viable." },
      { q: "¿Qué pasa si un sistema se cae durante la sincronización?", a: "Diseñamos reintentos con espera progresiva e idempotencia, y dejamos registro de cada operación para reprocesar lo que falló sin duplicar datos." },
    ],
    related: ["soluciones-erp", "automatizacion-de-procesos", "ecommerce"],
  },
  "automatizacion-de-procesos": {
    approach: [
      "Primero se mapea el proceso real y se elimina lo innecesario; recién después se automatiza.",
      "Automatizaciones con código propio o integraciones entre tus sistemas, según el caso, con registro de cada ejecución.",
      "Alertas cuando algo falla, para que una automatización no quede fallando en silencio.",
      "Documentación del flujo para que tu equipo lo entienda y pueda mantenerlo.",
    ],
    quoteInfo: [
      "El proceso paso a paso: quién hace qué, con qué herramientas y cuánto tarda.",
      "Qué errores o demoras ocurren hoy.",
      "Qué sistemas intervienen y si tienen API o exportación.",
      "Cuántas veces se repite el proceso (por día o por mes).",
    ],
    faqMore: [
      { q: "¿Qué procesos conviene automatizar primero?", a: "Los repetitivos, frecuentes y con reglas claras: carga de datos, reportes, notificaciones, conciliaciones. Los procesos con muchas excepciones se automatizan después o parcialmente." },
    ],
    related: ["integraciones-y-apis", "software-a-medida", "soluciones-erp"],
  },
  "aplicaciones-moviles": {
    approach: [
      "Flutter (Dart): una sola base de código para Android e iOS.",
      "Conexión con tu backend, ERP o sistemas internos mediante APIs REST.",
      "Autenticación y control de acceso por usuario; datos sensibles fuera del dispositivo cuando es posible.",
      "Publicación en las tiendas y documentación técnica.",
    ],
    quoteInfo: [
      "Quiénes usarán la app y en qué contexto (terreno, clientes, equipo interno).",
      "Funciones imprescindibles de la primera versión.",
      "Sistema o API con el que debe conectarse.",
      "Si necesita funcionar sin conexión, cámara, ubicación u otras funciones del teléfono.",
    ],
    faqMore: [
      { q: "¿Android e iOS al mismo tiempo?", a: "Sí, con Flutter se construye una base común para ambas plataformas. Las tiendas tienen sus propios requisitos de publicación, que revisamos al definir el alcance." },
    ],
    related: ["integraciones-y-apis", "software-a-medida", "soluciones-saas"],
  },
  "arquitectura-de-software": {
    approach: [
      "Diagnóstico de lo existente: estructura, dependencias, seguridad, rendimiento y despliegue.",
      "Recomendaciones priorizadas por impacto y riesgo, no una lista infinita de pendientes.",
      "Modernización incremental (por etapas) para no detener la operación.",
      "Decisiones documentadas para que tu equipo pueda sostenerlas.",
    ],
    quoteInfo: [
      "Descripción del sistema actual y tecnologías usadas.",
      "Los dolores concretos: lentitud, caídas, costo de cambios, seguridad.",
      "Acceso de lectura al código o a la documentación, si existe.",
      "Qué decisión necesitas tomar y para cuándo.",
    ],
    faqMore: [
      { q: "¿Cuándo conviene modernizar un sistema antiguo?", a: "Cuando cada cambio es lento o riesgoso, faltan personas que lo conozcan o ya no se puede integrar con otros sistemas. Casi siempre conviene hacerlo por etapas, no reescribir todo de una vez." },
    ],
    related: ["software-a-medida", "automatizacion-de-procesos", "soluciones-saas"],
  },
}
