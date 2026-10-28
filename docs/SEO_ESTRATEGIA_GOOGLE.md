# SEO Fase 2 — Estrategia para Google Chile

Fecha: 2026-10-28. Estado: **publicado en producción el 2026-10-28 (`5fef157411e565c093f1be62ecc79ae22ae0b69e`), desplegado por el titular.** Fase 1 `5298696`, Fase 2 `5fef157`. Verificación pública en §10.
Regla de este documento: no hay volúmenes de búsqueda, posiciones ni datos de herramientas SEO porque **no se tuvo acceso a ninguna**. Lo investigado es cualitativo (qué aparece, qué intención hay, quién compite).

## 1. Diagnóstico del SEO actual (medido el 2026-10-28)

Rastreo de las 21 URL del sitemap en producción (`5f00015`) y en el build local:

| Aspecto | Producción hoy | Local (con cambios) |
|---|---|---|
| Códigos HTTP | 200 en las 21; 404 real en rutas inexistentes; `www`→301; barra final→308 | igual |
| Duplicados de título / descripción / H1 | ninguno | ninguno |
| H1 por página | 1 | 1 |
| Imágenes sin `alt` | 0 | 0 |
| JSON-LD | válido en todas | válido en todas |
| Enlaces internos rotos | ninguno propio (el 404 de `/cdn-cgi/l/email-protection` es la ofuscación de correo de Cloudflare) | ninguno |
| Títulos | 30 a 94 caracteres (11 páginas pasaban de 70) | 47 a 63 |
| Descripciones | 7 pasaban de 160 (hasta 213) | máximo 166 (1 página) |
| Palabras visibles en HTML (sin ejecutar JS) | servicios 350–600 | ERP 1000, SaaS 860, a medida 720, integraciones 750, móviles 630, arquitectura 650, automatización 630 |
| Open Graph de `/nosotros` y `/contacto` | de la home (error) | propio |
| `/favicon.ico` | 404 | 200 |

El contenido importante está en el HTML del servidor (Next.js estático); Google lo lee sin ejecutar interacciones. Las preguntas frecuentes usan `<details>`: el texto está en el HTML.

### Lighthouse (lab, 1 corrida por URL; no son datos de usuarios)
| URL | Producción · móvil | Local · móvil | Producción · escritorio | Local · escritorio |
|---|---|---|---|---|
| Home | rend. 77 · LCP 4,33 s · TBT 172 ms · SEO 92 | 88 · 3,70 s · 80 ms · SEO 100 | 98 · 1,01 s | 99 · 0,96 s |
| /servicios/soluciones-erp | 89 · 3,44 s · TBT 58 ms · SEO 92 | 92 · 3,17 s · 72 ms · SEO 100 | 99 · 0,78 s | 100 · 0,70 s |

Accesibilidad 100 en todas, CLS 0. Comparar producción con local no es equivalente (la producción pasa por Cloudflare y la red; el local es HTTP en la misma máquina). Las diferencias de rendimiento no se atribuyen a los cambios. **Lo que sí es real: SEO 92 en producción** por una sola causa, `robots.txt` con la línea `Content-Signal: search=yes,ai-train=no,use=reference` que inserta **Cloudflare** («robots.txt no es válido: directiva desconocida»). Google ignora directivas desconocidas, así que no afecta el rastreo; es un puntaje de laboratorio, no un problema de indexación. No se toca (configuración de Cloudflare).
«Mejores prácticas» 81 en local solo por servirse por HTTP; en producción es 100.

## 2. Problemas encontrados, por impacto

| # | Problema | Impacto | Estado |
|---|---|---|---|
| 1 | **Indexación no verificada**: no se puede saber desde fuera si Google indexa el sitio; no hay verificación de Search Console visible (sin etiqueta `google-site-verification`; el TXT de DNS no se pudo comprobar con un servidor no autoritativo) | Alto | Acción del titular (§6) |
| 2 | **Colisión de marca**: «Byd Light» se confunde con BYD (fabricante chino). Una búsqueda de `bydlightsolutions.com Byd Light Solutions` no devolvió el sitio, solo contenido de BYD (la herramienta de búsqueda es de EE. UU. y no prueba nada sobre Google Chile, pero el riesgo es real) | Alto | Mitigado: `legalName` «Byd Light Solutions SpA» y `alternateName` «Bydlight» en el JSON-LD; hay que reforzar con perfiles y menciones coherentes |
| 3 | Páginas de servicio delgadas (350–600 palabras) y sin enfoque técnico, método ni datos para cotizar | Alto | Corregido en 7 servicios comerciales |
| 4 | Títulos largos (hasta 94) y duplicando la marca | Medio | Corregido (Fase 1 y 2) |
| 5 | Open Graph incorrecto en 2 páginas, favicon 404 | Medio | Corregido (Fase 1) |
| 6 | Sin contenido editorial: no hay páginas para búsquedas informativas («cuánto cuesta…») | Alto a mediano plazo | Plan en §5; no se redactó (primero se valida con el titular) |
| 7 | Sin enlaces entrantes ni perfiles externos verificables | Alto | Acción del titular (§7) |
| 8 | `http://` responde 200 sin redirigir a HTTPS | Bajo/medio | Cloudflare «Always Use HTTPS»; no se toca sin autorización |
| 9 | Sin dirección física ni perfil de empresa local | Medio (búsquedas locales) | Depende de si existe dirección real |
| 10 | Sitemap sin `lastmod` | Bajo | Se deja sin `lastmod` a propósito: poner la fecha de build en todas las URL sería información falsa |

## 3. Correcciones implementadas

Fase 1 (commit `5298696`, intacta): metadatos Open Graph/Twitter completos por página (`src/lib/seo.ts`), títulos y descripciones acortados, `BreadcrumbList` en 4 páginas más, `favicon.ico`.

Fase 2 (este trabajo, sin commit aún):
1. **Siete páginas comerciales ampliadas** (`src/lib/service-extras.ts` + `src/app/servicios/[slug]/page.tsx`): ERP, SaaS, software a medida, integraciones y APIs, automatización, aplicaciones móviles y arquitectura. Cada una suma: *Enfoque y tecnologías*, *Cómo trabajamos* (5 pasos), *Qué necesitamos para cotizar*, *Servicios relacionados* (enlaces internos con texto descriptivo) y 1–2 preguntas frecuentes nuevas.
2. **SAP Business One** se presenta solo como capacidad de integración vía Service Layer, con la aclaración explícita «no somos partner ni revendedor de SAP». No se afirma certificación ni alianza.
3. **Se retiró el marcado `FAQPage`** de servicios y planes: Google restringe esos resultados enriquecidos y no hay que apostar por ellos. Las preguntas siguen visibles en la página.
4. Títulos de proyectos acortados y descripciones cortas completadas.
5. `legalName` y `alternateName` en el JSON-LD de Organization (datos del titular, no inventados).

No se tocaron el hero, el diseño, Docker, Cloudflare, Webpay ni la navegación.

## 4. Investigación de búsquedas comerciales (cualitativa)

**Qué se hizo:** búsquedas web (herramienta con índice de EE. UU.; resultados orientativos para Chile). **Qué NO hay:** volúmenes, posiciones, dificultad medida. La dificultad es una estimación cualitativa por quién compite.

Quién aparece para «desarrollo de software a medida Chile»: directorios y marketplaces (TechBehemoths, GoodFirms, Mercantil, Gust), consultoras (Codelan, Good-Factory, Puntonet, Just Dev It, Bakslash, Cox Digital) y páginas de precios como la de 2x3. Para precios: guías de 2x3 y Yourdevs (rangos de agencias, no verificados). Para SAP Business One en Chile: casi todo es contenido en inglés genérico o de partners (p. ej. Exxis, Simplo para facturación electrónica); hay poco contenido en español chileno específico de integración vía Service Layer.

| Tema | Intención | Relevancia para Byd Light | Dificultad estimada | Página destino |
|---|---|---|---|---|
| Desarrollo de software a medida en Chile / empresa de desarrollo de software | Comercial | Muy alta | Alta (agencias y directorios establecidos) | `/servicios/software-a-medida` |
| Integración SAP Business One (Service Layer, ecommerce, API) | Comercial técnica | Muy alta (nicho, poca competencia en español) | Baja–media | `/servicios/soluciones-erp`, `/servicios/integraciones-y-apis` |
| Integración de sistemas ERP | Comercial | Alta | Media | `/servicios/soluciones-erp` |
| Integraciones API empresariales | Comercial técnica | Alta | Media | `/servicios/integraciones-y-apis` |
| Automatización de procesos empresariales | Comercial/informativa | Alta | Media–alta (RPA y herramientas low-code dominan) | `/servicios/automatizacion-de-procesos` |
| Desarrollo de aplicaciones web empresariales / SaaS | Comercial | Alta | Alta | `/servicios/soluciones-saas` |
| Desarrollo de aplicaciones móviles (Flutter) | Comercial | Media | Alta | `/servicios/aplicaciones-moviles` |
| Sistemas de gestión empresarial | Informativa/comparativa | Media (dominada por ERP estándar: Softland, Nubox, etc.) | Alta | `/servicios/soluciones-erp` |
| «Cuánto cuesta…» (software, app, ERP) | Informativa con intención de compra | Alta | Media (hay guías de agencias) | Artículos (§5) |

Conclusión: el mejor retorno está en el **nicho SAP Business One + integración/API + ecommerce**, donde la oferta en español es escasa y se puede demostrar capacidad técnica real; el genérico «software a medida Chile» es muy competido y se ataca mejor con contenido útil y enlaces que con más palabras clave.

## 5. Plan editorial (10 artículos) — **solo propuesta, nada redactado**

Cada artículo debe tener datos propios o fuentes citadas, sin cifras inventadas ni casos de clientes no verificables.

| # | Tema | Intención | Enlaza a |
|---|---|---|---|
| 1 | ¿Cuánto cuesta desarrollar software a medida en Chile? (factores de costo, cómo cotizar, qué pedir) | Informativa/compra | software-a-medida, contacto |
| 2 | ¿Cuándo conviene un ERP personalizado y cuándo uno estándar? | Comparativa | soluciones-erp |
| 3 | Cómo integrar SAP Business One con tu tienda online u otros sistemas (Service Layer, mapeo de datos, ambiente de pruebas) | Técnica/comercial | soluciones-erp, integraciones-y-apis |
| 4 | Facturación electrónica y ERP: por qué un documento contabilizado no es un DTE (lo que hay que validar con tu proveedor) | Técnica | soluciones-erp |
| 5 | Automatización de procesos: qué automatizar primero y qué no | Informativa | automatizacion-de-procesos |
| 6 | Software a medida vs SaaS: cómo decidir | Comparativa | software-a-medida, soluciones-saas |
| 7 | Cómo modernizar un sistema empresarial antiguo sin detener la operación (por etapas) | Informativa | arquitectura-de-software |
| 8 | Qué debe tener una API empresarial: autenticación, reintentos, idempotencia, registro | Técnica | integraciones-y-apis |
| 9 | App móvil para tu empresa: Flutter, costos y cuándo no necesitas una app | Informativa/comercial | aplicaciones-moviles |
| 10 | Ley 21.719 de datos personales: qué cambia para tu sistema (verificar vigencia: 1 dic 2026, con un proyecto que la posterga a 2027 en trámite; no es asesoría legal) | Informativa/actualidad | software-a-medida, arquitectura-de-software |

Orden sugerido por retorno: 3, 1, 2, 4, 6. Requiere una sección `/blog` (o `/guias`) con sitemap, `Article` JSON-LD y autoría real. Pendiente de tu aprobación de temas.

## 6. Guía de Google Search Console

**Qué se pudo verificar sin acceso:** no hay etiqueta `google-site-verification` en el HTML; el DNS TXT visible desde aquí (servidor no autoritativo) solo muestra Zoho (correo) y SPF. Eso **no prueba** que no esté verificado (puede estar por DNS en otro registro o por Google Analytics). Para comprobarlo: entra a https://search.google.com/search-console con la cuenta del titular; si `bydlightsolutions.com` aparece en la lista de propiedades, ya existe.

Pasos si no existe (no se pidieron credenciales ni se tocó DNS):
1. En Search Console, **Agregar propiedad → Dominio** y escribir `bydlightsolutions.com`.
2. Google entrega un registro **TXT** (`google-site-verification=…`).
3. En Cloudflare → DNS → Agregar registro TXT, nombre `@`, ese valor. Es un cambio de DNS **que debe hacer el titular**.
4. Volver a Search Console y pulsar **Verificar** (puede tardar minutos).
5. **Sitemaps** → enviar `sitemap.xml`.
6. **Inspección de URL** para: `/`, `/servicios/software-a-medida`, `/servicios/soluciones-erp`, `/servicios/integraciones-y-apis`, `/planes`, `/contacto`. Revisar «La URL está en Google» y, si no, **Solicitar indexación**.
7. Informe **Páginas**: revisar «No indexadas» y el motivo (rastreada sin indexar, duplicada, redirección).
8. Informe **Rendimiento**: clics, impresiones, CTR y posición media; filtrar por País = Chile.
9. Registrar en una planilla, el día de la verificación y a los **30, 60 y 90 días**: clics, impresiones, CTR, posición media, páginas indexadas y las 10 consultas principales. Comparar contra el día 0.
10. Opcional: Bing Webmaster Tools (importa desde Search Console).

Tras el despliegue de estos cambios, solicitar nueva indexación de las 7 páginas de servicio ampliadas.

## 7. Acciones fuera del código (titular)
- Perfil de Empresa en Google solo si hay dirección o área de servicio real, con el mismo nombre/teléfono del sitio.
- Perfiles consistentes (LinkedIn de empresa, directorios chilenos de software) con el nombre completo «Byd Light Solutions SpA» y el enlace al sitio, para reforzar la identidad frente a BYD.
- Enlaces entrantes legítimos: portafolio de clientes con su permiso, colaboraciones, directorios de calidad. Nada comprado.
- Cloudflare «Always Use HTTPS» (autorizar o hacer el titular).

## 8. Resultados de pruebas
`tsc` sin errores · ESLint sin errores · 18/18 pruebas · build correcto · rastreo de 21 URL (sin duplicados, 1 H1, 0 imágenes sin alt, JSON-LD válido, 0 enlaces rotos propios) · Lighthouse de la tabla §1 · hero sin cambios.

## 9. Próximos 90 días
- **Días 0–7:** aprobar y desplegar estos cambios; verificar Search Console; enviar sitemap; solicitar indexación de las páginas prioritarias; anotar la línea base.
- **Días 7–30:** publicar los 2–3 primeros artículos (3, 1, 2) con revisión técnica real; perfiles externos coherentes; añadir casos con evidencia en `/proyectos` cuando existan.
- **Días 30–60:** medir en Search Console qué consultas dan impresiones; reescribir títulos/descripciones de páginas con impresiones y poco CTR; publicar 2–3 artículos más.
- **Días 60–90:** consolidar lo que posiciona, ampliar el nicho SAP/API, evaluar página de ecommerce+ERP; revisar enlaces entrantes conseguidos.
- **Medir solicitudes de cotización** (formulario y WhatsApp) por página de origen; es la métrica que importa más que la posición.

## 10. Verificación en producción tras el despliegue (2026-10-28)
- 21 URL del sitemap en 200; sin títulos, descripciones ni H1 duplicados; títulos 47-63 caracteres; canonical y og:url propios por página; JSON-LD válido en todas (con legalName); /favicon.ico 200; sin noindex.
- robots.txt: el grupo User-agent: * permite todo y no hay reglas para Googlebot; Cloudflare bloquea crawlers de entrenamiento de IA (GPTBot, ClaudeBot, Google-Extended, GoogleOther, etc.), lo que no afecta a Googlebot. Sitemap declarado.
- Hero 3D activo tras ir al inicio por el logo y recargar; 0 errores de consola en escritorio (1440) y móvil (390); sin desborde; /contratar 307 y /orden 404 (Webpay apagado).
- Las páginas son rastreables e indexables; no se sabe si Google ya las indexó (requiere Search Console).
- Pendiente en PowerShell: status / list-releases (campo anterior válido para rollback).
