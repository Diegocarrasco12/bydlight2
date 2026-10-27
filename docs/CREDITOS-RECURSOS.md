# Créditos y licencias de recursos visuales

Las imágenes de biblioteca son **ilustrativas** (conceptos): no son instalaciones, equipos ni proyectos de Byd Light Solutions, y el sitio lo indica en pantalla.

## Fotografías (Pexels License)
Licencia: https://www.pexels.com/license/ — uso comercial permitido, sin atribución obligatoria, modificación permitida. No se redistribuyen como stock ni se usan como marca.
Optimizadas a WebP (640 y 1280 px; la banda a pantalla completa también 1920 px para alta densidad) en `public/img/stock/`; se sirven desde nuestro propio dominio (sin dependencia externa en ejecución).

| Archivo | Fuente | Uso |
|---|---|---|
| `centro-de-datos-*.webp` | https://www.pexels.com/photo/4508751/ | Banda «Producción» (home) |
| `codigo-react-*.webp` | https://www.pexels.com/photo/4164418/ | Sección «Método» |
| `fibra-optica-*.webp` | https://www.pexels.com/photo/2881229/ | Fondo tenue del contacto (home) |

Detalles: originales descargados de `images.pexels.com` (1920 px) el 2026-10-27; convertidos con Pillow a WebP (calidad 55–66, `method=6`). Variantes: `centro-de-datos` 640/1280/1920 px
(28/131/348 KB), `codigo-react` 640/1280 px (13/39 KB), `fibra-optica` 640/1280 px (17/38 KB). Los nombres de los fotógrafos no se registraron (la atribución no es obligatoria; si se desea acreditar, consultarlos en la página
de cada foto). Restricciones de Pexels (comprobadas en su página de licencia): no revender copias sin modificar, no sugerir que las personas o marcas retratadas respaldan el producto, no usarlas como marca,
no redistribuirlas en otras plataformas de stock. Se evaluó y **descartó** una foto con portada de libro de una marca editorial reconocible.

## Logos de tecnologías (Simple Icons, CC0 1.0)
https://simpleicons.org — trazados incrustados en `src/lib/techLogos.ts`. Las marcas pertenecen a sus titulares y se muestran solo para nombrar tecnologías usadas. «C#» y «Windows Forms» usan una insignia de texto propia (no el logo oficial).

## Capturas de proyectos (`public/img/portfolio/*.webp`)
Capturas de pantalla de sitios **publicados** (Only Energy, CFT Magallanes, GINFET, Angel & Eva), tomadas con Playwright durante la jornada anterior, y de la **demo propia** de escritorio (`software-escritorio-demo.webp`, datos ficticios,
código en `demos/windows-inventory/`). **El permiso de los titulares para mostrar las capturas no está documentado en el repositorio: pendiente de confirmar.** No se presentan interfaces ficticias como productos entregados.

## Marca propia y otros archivos (procedencia/licencia **no documentadas**)
`public/img/logos/*` (logo2 es el usado por `SITE.logo`; `logo2-sm.png` el pequeño; `logo1,3,4,5,6.png` y `favicon.png` sin uso verificado), `public/favicon.png`, `public/icon-192.png`, `public/og-image.png`,
`public/img/clients/cft.png`, `src/assets/images/hero-bg.jpeg`. Se asume material de marca propia aportado por el titular; **confirmar**. `og-image.png` no se regeneró con la identidad nueva. Los PNG de logo pesan hasta 1,4 MB
(optimización pendiente si se usan en rutas críticas).

## Videos
No se incorporó video: la licencia de los videos de Mixkit («Restricted») no pudo verificarse y no se localizaron videos de Pexels adecuados. Pendiente si se aporta material propio.

## Tecnologías: qué es experiencia y qué es proyecto demostrable
- **Experiencia técnica declarada por el titular** (sección «Con qué construimos»): C#, .NET / ASP.NET Core, Node.js, Python, Java / Spring Boot, PHP, APIs REST, JavaScript / TypeScript, React / Next.js, Flutter / Dart, Windows Forms, SQL Server, PostgreSQL, MySQL, SQLite, Docker, Linux, Windows Server / IIS, Git, Cloudflare, SAP Business One y Service Layer. Se presentan como capacidades, sin clientes, cifras ni certificaciones.
- **Proyectos demostrables** (`/proyectos`): solo muestran las tecnologías comprobadas en el sitio público o en código propio (Only Energy: Next.js y React; demo de escritorio: C#, .NET 8, Windows Forms).
- El ejemplo de Service Layer del home es ilustrativo (no es código ni datos de un cliente).

## Pendientes de material real
- Capturas de CFT Magallanes, GINFET y Angel & Eva en móvil (hoy solo escritorio).
- Casos con problema/solución/resultado documentados por el cliente (no se inventan cifras).
- Autorización explícita de clientes antes de nombrar integraciones SAP concretas como casos.
