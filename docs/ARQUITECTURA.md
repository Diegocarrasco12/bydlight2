# Arquitectura de Bydlight2

Estado al **2026-10-27**, commit desplegado `56fdcf1`. Marcas: **[V]** = verificado en el código o en pruebas de esta jornada;
**[C]** = requiere confirmación (no comprobado).

## 1. Visión general

Sitio corporativo en español (`lang="es"`) de Byd Light Solutions SpA. Next.js 16.4.3 (App Router, Turbopack) con React 19.2.3 y
TypeScript, empaquetado como imagen Docker `output: "standalone"` que corre en un servidor Ubuntu propio detrás de un Cloudflare
Tunnel. Sin base de datos ni servicios adicionales en producción. **[V]**

## 2. Dependencias principales

| Paquete | Versión | Uso |
|---|---|---|
| `next` | 16.4.3 | Framework (App Router, standalone) |
| `react`, `react-dom` | 19.2.3 | UI |
| `three` | 0.170.0 (exacta) | Escena 3D del hero, cargada de forma diferida |
| `@emailjs/browser` | ^4.4.1 | Envío del formulario de contacto (import dinámico al enviar) |
| `transbank-sdk` | 6.1.1 | Solo para el flujo de pagos **desactivado** (sin uso en producción) |
| `typescript` ^5, `eslint` ^9, `eslint-config-next` 16.4.3, `@types/three` 0.170.0 | — | Desarrollo |

Se eliminó `framer-motion` (sin uso). `npm audit`: 0 vulnerabilidades al momento de la reconstrucción. **[V]**
Imagen base: `node:22.23.4-alpine` fijada por digest (ver `Dockerfile`). Las fuentes se descargan de Google Fonts **en el build**
(`next/font/google`): el build necesita red; en ejecución no hay dependencia externa de fuentes. **[V]**

## 3. Organización del código

```
src/app/                 Rutas (App Router) + layout.tsx, globals.css, sitemap.ts, robots.ts
  page.tsx               Home
  servicios/ [slug]/     Listado y detalle de servicios (estático desde src/lib/services.ts)
  proyectos/ [slug]/     Portafolio y detalle por proyecto (src/lib/portfolio.ts)
  planes/ nosotros/ contacto/
  contratar/ orden/ api/ Flujo de pagos (INACTIVO, ver §8)
src/components/
  hero/HeroNetwork.tsx   Hero VIGENTE de la portada (desde la Fase 3): red de nodos metálicos, sin scroll pegajoso + hero/scene-network.ts (three.js)
  hero/HeroStage.tsx     LEGADO sin uso (átomo/«núcleo de luz» anterior) + hero/scene.ts. Se conserva hasta confirmar que nada depende de ellos
  home/enterprise.tsx    EnterpriseBand (portada), EnterpriseCards y ServicesByCategory (/servicios): soluciones ERP/SaaS y servicios por categoría
  home/blocks.tsx        Bloques de la home: Capabilities, InfraBand, ProjectsShowcase, ApiSection, Method, TechSection, PlansTeaser, HomeContact
  home/sections.tsx      ServicesGrid, PlansGrid, PlanComparison, MaintenanceBlock, Faq, FinalCta
  portfolio/             Portfolio.tsx (ProjectFeature/Card/Grid/DesktopShowcase) y Frames.tsx (marcos de navegador/app)
  layout/PageHero.tsx    Cabecera de páginas internas
  navbar/ footer/ contact/ContactForm.tsx seo/JsonLd.tsx checkout/ (pagos, inactivo)
src/lib/                 Datos y utilidades: site.ts, services.ts, plans.ts, portfolio.ts, techLogos.ts, payments/ (inactivo)
src/styles/design.css    Sistema visual «Núcleo» (tokens, componentes, responsive) — único CSS de diseño
tests/                   18 pruebas (Node test runner): pagos (SQLite, firma admin) + smoke de módulos TS
deploy/executor/         Ejecutor restringido bd-deploy (servidor + cliente Windows) y sus 129 pruebas en Python
demos/windows-inventory/ Demo propia de software de escritorio (C# / .NET 8 / Windows Forms)
docs/  scripts/  Dockerfile  docker-compose.prod.yml  DEPLOY.md
```

## 4. Rutas públicas **[V]** (build del 2026-10-27)

`/`, `/servicios`, `/servicios/[slug]` (8 servicios: desarrollo-web, ecommerce, software-a-medida, arquitectura-de-software,
aplicaciones-moviles, integraciones-y-apis, automatizacion-de-procesos, mantenimiento-web), `/proyectos`, `/proyectos/[slug]`
(only-energy, cft-magallanes, ginfet, angel-y-eva, software-escritorio-windows), `/planes`, `/nosotros`, `/contacto`, `/sitemap.xml`
(19 URL), `/robots.txt`. Rutas restringidas: ver §8.

## 5. Hero 3D y animaciones **[V]**

> **Vigente desde la Fase 3 (2026-10-28):** la portada usa `HeroNetwork.tsx` + `scene-network.ts` (red de nodos metálicos). Lo descrito abajo para
> `HeroStage.tsx`/`scene.ts` corresponde al hero anterior y queda como referencia histórica.
> - Grilla normal (copia + escenario 3D), sin `position: sticky`; en móvil el 3D tiene su propio bloque entre el titular y los botones.
> - `scene-network.ts`: `InstancedMesh` para nodos (metal oscuro, `MeshPhysicalMaterial` en escritorio y `MeshStandardMaterial` en móvil) y para conexiones; un único `Points`
>   para los pulsos de luz; entorno de reflejos procedural (`RoomEnvironment` + PMREM), sin HDRI descargado ni sombras dinámicas. 46 nodos en escritorio, 30 en móvil.
> - Arranque: con la primera interacción o a los 3,5 s (como el hero anterior), con el navegador ocioso; la escena se construye en tareas cortas y compila shaders con
>   `compileAsync`. Mientras tanto se ve una red SVG estática, que también es el respaldo sin WebGL, con ahorro de datos o equipo modesto.
> - `prefers-reduced-motion`: un solo cuadro 3D fijo y ningún cuadro de animación. Se pausa fuera de pantalla y con la pestaña oculta.

- `HeroStage.tsx` (cliente): sección `.hx` de ~330vh (260vh en móvil) con contenido `sticky`. Un listener de scroll (rAF) escribe la
  variable CSS `--p` (0–1) y `data-stage` (1/2/3). El titular, los botones y el mockup del producto real (Only Energy) son HTML/CSS:
  el LCP no depende de WebGL.
- `scene.ts` (three.js, importado dinámicamente): núcleo de luz, halos con shader, anillos, partículas aditivas (1100 en escritorio,
  380 en móvil), cuadrícula tipo plano y seis paneles que se ensamblan sobre el rectángulo del mockup DOM («dock»). Parallax de puntero solo
  en escritorio; DPR máx. 1,5 (1 en móvil); límite de 50 fps (30 en móvil); pausa fuera de pantalla (IntersectionObserver); `dispose` al desmontar.
- Arranque: escritorio con `requestIdleCallback`; **móvil** con la primera interacción (scroll/touch/pointer) o a los 3,5 s.
- Niveles de degradación: (1) escena 3D; (2) `hx--static` (composición CSS con núcleo y plano) si hay `prefers-reduced-motion`, ahorro
  de datos, `hardwareConcurrency < 4`, `deviceMemory < 4`, sin WebGL o error al crear el renderer; (3) sin JavaScript (`<noscript>`).
  No se sondea WebGL con contextos de prueba (era caro); si el renderer falla, se cae a estático.
- Revelado por scroll: CSS puro (`.rv`, `animation-timeline: view()` con `@supports`), desactivado con `prefers-reduced-motion`.
- Movimiento limitado a `transform`/`opacity`.

## 6. Formularios y contacto **[V]**

- `ContactForm.tsx` envía por EmailJS desde el navegador (`sendForm`); service/template/public key (públicos por diseño) están en el
  propio archivo, no en variables de entorno. EmailJS se descarga solo al enviar. Con `?plan=<id>` precarga el mensaje del plan.
- WhatsApp: `whatsappLink()` en `src/lib/site.ts`. Correo y teléfono públicos: `SITE` en el mismo archivo.
- En la jornada se probó el envío **interceptando** la llamada de red (no salió ningún correo real). La prueba real está pendiente (`PENDIENTES.md`).

## 7. SEO y seguridad **[V]** salvo indicación

- Metadatos por página (`title`, `description`, `canonical`), Open Graph, JSON-LD (Organization/ProfessionalService, breadcrumbs en
  proyectos), `sitemap.ts` (incluye servicios y proyectos; excluye `/contratar` y `/orden`), `robots.ts`, un solo `<h1>` por página.
- Cabeceras desde `next.config.ts`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`;
  `/orden` y `/api` con `Cache-Control: no-store` y `noindex`. `poweredByHeader: false`.
- **Caché** (corrige HTML viejo tras despliegues): HTML con `public, max-age=0, must-revalidate`; `/img/*` con 1 día + SWR; `/_next/static`
  inmutable (lo marca Next).
- **No hay `Strict-Transport-Security` ni `Content-Security-Policy` en el origen** (comprobado en local). **[C]** si Cloudflare los agrega en el
  dominio público: no se verificó. Pendiente de evaluación (`PENDIENTES.md`).
- Contenedor: usuario no root, sistema de archivos de solo lectura, `cap_drop: ALL`, `no-new-privileges`, puerto solo en `127.0.0.1`,
  sin volúmenes ni variables de entorno (política del ejecutor, ver `DEPLOY.md`).

## 8. Pagos (Webpay Plus): construidos, **apagados** **[V]**

- Código presente: `src/lib/payments/*` (SQLite con `node:sqlite`, migraciones, API administrativa firmada HMAC), `src/app/api/pagos/*`,
  `/contratar`, `/orden`, `src/components/checkout/*`, scripts `scripts/*admin*.mjs`.
- Apagado por diseño: `ONLINE_CHECKOUT_UI = false` (`src/lib/plans.ts`), `planHref()` → `/contacto?plan=…`; `paymentsEnabled()` es falso por
  defecto en producción (la configuración vendría de `/data/config/payments.json`, que no existe). Comprobado: `/contratar` → 307 a `/contacto`;
  `/orden` y `/orden/[id]` → 404; POST `/api/solicitudes` → 403; `/api/admin` → 404/405; sin mención de Webpay/Transbank en el HTML público;
  no se crean base de datos ni archivos.
- Activarlo exige volumen + variables/archivo de configuración + `accept-compose` + credenciales de Transbank: **no hacerlo sin autorización**.
  Procedimiento: `docs/ACTIVACION-WEBPAY.md`; SQLite: `docs/PAGOS-SQLITE.md`.

## 9. Lo que requiere confirmación **[C]**

- Texto comercial «13+ años en operaciones reales» (heredado del sitio anterior; no verificado en esta jornada).
- Cabeceras HSTS/CSP en el dominio público.
- Régimen tributario detrás de los precios «+ IVA».
- Permiso de los clientes para mostrar sus capturas (`docs/CREDITOS-RECURSOS.md`).
- `public/og-image.png`: no se regeneró para la identidad nueva (no verificado su contenido actual).
