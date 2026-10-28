# SEO — Bydlight2

## Implementado (2026-10-28, pendiente de despliegue hasta confirmar en `ESTADO_ACTUAL.md`)
- `src/lib/seo.ts`: `pageMetadata()` (title, description, canonical, Open Graph completo con imagen, `site_name`, `es_CL` y Twitter) y `breadcrumbLd()`. Todas las páginas lo usan; antes `/nosotros` y `/contacto` heredaban el OG de la home.
- Títulos acortados a ~55-61 caracteres con marca (antes hasta 83). Descripciones ≤ ~160.
- JSON-LD `BreadcrumbList` en /servicios, /proyectos, /nosotros y /contacto (ya existía en planes, servicios/[slug] y proyectos/[slug]).
- `public/favicon.ico` (48×48) y referencia en `icons` (antes 404).

## Ya existente
Canonical por página, sitemap (19 URL), robots, Organization/WebSite/ProfessionalService, FAQPage y Service por servicio, un solo h1, alt en imágenes, www→301.

## Acciones del titular (no son código)
1. Verificar el dominio en **Google Search Console** (propiedad de dominio por DNS) y enviar `https://bydlightsolutions.com/sitemap.xml`; revisar «Páginas» y solicitar indexación de la home.
2. Crear y verificar el **Perfil de Empresa en Google** (si hay dirección/área de servicio real) con los mismos nombre, teléfono y sitio.
3. Bing Webmaster Tools (importa desde Search Console).
4. Cloudflare: «Always Use HTTPS» (hoy `http://` responde 200 sin redirigir). No tocado sin autorización.
5. Enlaces entrantes reales: directorios chilenos, sitios de clientes con permiso, perfiles de empresa. Sin compras de enlaces.

## Ideas de contenido (requieren evidencia real; no inventar casos ni cifras)
Guías útiles por intención de búsqueda («cuánto cuesta una página web en Chile», «integrar SAP Business One con tu tienda online»), y páginas de proyectos con resultados verificables.
