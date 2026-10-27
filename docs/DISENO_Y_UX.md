# Diseño y experiencia de usuario

Evolución visual de la jornada del 2026-10-27 y dónde está implementada cada decisión.

## 1. Objetivo y preferencias del titular

- Bydlight Solutions: empresa de **ingeniería y desarrollo de software** (no agencia de plantillas), para clientes en Chile y eventualmente del exterior.
- Estilo pedido: **premium, realista, profesional, alto contraste, contenido auténtico**; impacto inicial fuerte pero que no parezca «maqueta» ni
  contenido generado por IA; menos texto, más demostración visual; español natural y comercial; sin frases grandilocuentes.
- Referencias de diseño (no copiadas): Hostinger y el sitio de Only Energy como calidad de presentación; análisis previo de Vercel, Linear, Framer, Stripe y Raycast
  (ver la auditoría de la conversación; no hay capturas versionadas).
- Identidad: conceptos «Del plano al producto» + «Núcleo de luz». Tokens en `src/styles/design.css` (`--ink #04060c`, `--blue #2f7bff`, `--cyan #5ee6ff`,
  `--orange #ff7a1a`); tipografías Bricolage Grotesque (títulos), Geist y Geist Mono.

## 2. Evolución de la jornada

| Etapa (commit) | Cambio principal |
|---|---|
| `af71054` | Reconstrucción total: hero cinematográfico 3D con producto real (Only Energy), páginas Inicio/Servicios/Proyectos/Nosotros/Contacto/Planes, móvil diseñado aparte (menú a pantalla completa, barra inferior WhatsApp + Cotizar), corrección de caché del HTML |
| `26a4cea` | Contraste (secciones claras), banda fotográfica de producción, método con foto, sección de APIs/SAP, tecnologías con logos, eliminación total de WordPress, copy más corto |
| `56fdcf1` | Tecnologías por categoría, tarjeta de integración empresarial, servicio «Aplicaciones móviles», responsive 320–1440 sin desbordamientos, mejoras de rendimiento y accesibilidad |

## 3. Decisiones de diseño y su ubicación

- **Mayor realismo:** el hero termina mostrando una captura real de un producto en producción dentro de un marco de navegador (`HeroStage.tsx`,
  `portfolio/Frames.tsx`), con línea de prueba «En producción: Only Energy · CFT Magallanes · GINFET». Sin interfaces ficticias presentadas como entregadas;
  la demo de escritorio se etiqueta «Demo propia · datos ficticios».
- **Contraste entre secciones:** ritmo oscuro → foto → claro → oscuro → claro. Clase `.bd-light` (en `design.css`) redefine tokens (`--text`, `--muted`, `--cyan`)
  para Proyectos y Tecnologías sobre `#eef2f8`; el resto es oscuro. Evita una sucesión de tarjetas oscuras iguales.
- **Fotografías de Pexels:** tres imágenes ilustrativas con leyenda «Imagen ilustrativa · Pexels» (`InfraBand`, `Method`, fondo tenue de `HomeContact` en
  `home/blocks.tsx`); carga diferida, `srcset`, WebP. Inventario y licencia en `docs/CREDITOS-RECURSOS.md`.
- **Presentación de proyectos:** Only Energy destacado con cuatro capturas reales y detalle propio (`/proyectos/[slug]`); los demás en tarjetas/riel con *snap*
  en móvil; datos y tecnologías verificadas en `src/lib/portfolio.ts`. Excluidos a propósito: Logistic Control Center, Tu Farmacia Digital y Constructora MYD.
- **Sección de tecnologías (`TechSection`):** tarjeta destacada «Integración empresarial» (SAP Business One · Service Layer, APIs REST, seguridad de APIs,
  automatización) + cuatro categorías (Backend y APIs, Frontend y aplicaciones, Bases de datos, Infraestructura). Logos Simple Icons (CC0) en
  `src/lib/techLogos.ts`; insignias de texto propias para Java, C#, SQL Server, Windows Forms e IIS (sin logo disponible). Se presenta como **experiencia técnica**;
  los proyectos demostrables están en `/proyectos`. Nota visible: «Experiencia técnica del equipo…».
- **Integraciones empresariales / SAP Business One Service Layer:** `ApiSection` (home) con un ejemplo **ilustrativo** (login con sesión, consulta OData paginada, lote
  transaccional) y buenas prácticas (OpenAPI, secretos fuera del código, reintentos con idempotencia, paginación y límites de tasa, trazabilidad, pruebas en ambiente de pruebas).
  Se presenta como capacidad de servicio, no como caso de cliente. Detalle ampliado en el servicio `integraciones-y-apis` (`src/lib/services.ts`).
- **Aplicaciones móviles:** servicio nuevo `aplicaciones-moviles` (Flutter para Android e iOS conectado a APIs); aparece en la home, menú, pie y sitemap.
- **Responsive:** móvil 320–430 con menú de pantalla completa (`inert` al cerrar, Escape), barra inferior fija, hero con núcleo más bajo y un solo CTA visible; riel
  horizontal de proyectos; columnas con `minmax(0,1fr)`; recorte horizontal de resplandores (`overflow-x: clip` en secciones decorativas).
- **Accesibilidad:** contraste revisado solo con Lighthouse (accesibilidad 100, incluye la auditoría de contraste; no se hizo auditoría manual WCAG); foco visible (`:focus-visible`); `aria-labelledby` por sección; menú con `inert`; un único `h1`; tamaños de texto ≥ 12 px;
  orden de encabezados corregido en `/proyectos`; `prefers-reduced-motion` respeta todo el movimiento.
- **Animaciones y rendimiento:** solo `transform`/`opacity`; escena 3D diferida (en móvil, tras la primera interacción o 3,5 s); EmailJS cargado al enviar;
  `three` en un chunk aparte; ver `docs/CALIDAD_Y_PRUEBAS.md`.

## 4. Contenido comercial

- Mensajes cortos y concretos; sin cifras, clientes, testimonios ni certificaciones inventados.
- Planes web con precios «Desde $X + IVA» (`src/lib/plans.ts`; `IVA_LABEL`, `PRICE_NOTE`); régimen tributario pendiente de confirmar.
- «13+ años en operaciones reales» (Nosotros) se **conservó** del sitio previo; **pendiente de confirmación comercial**.
- Prohibido en la experiencia pública: la palabra «WordPress» (y «Divi»). Verificado con búsqueda insensible a mayúsculas en `src`, `public` y HTML renderizado (la documentación interna la menciona solo como regla de exclusión).
