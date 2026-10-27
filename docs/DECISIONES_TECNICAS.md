# Decisiones técnicas

Registro de decisiones importantes, con motivo y dónde viven. Fechas 2026-10-26/27 salvo indicación.

| # | Decisión | Motivo | Dónde |
|---|---|---|---|
| 1 | Mantener **Next.js** (App Router) y no migrar | Funciona, se despliega con el ejecutor existente; no hubo razón técnica verificable para cambiar | `package.json`, `next.config.ts` |
| 2 | Salida **standalone** + imagen Docker mínima con Node fijado por digest | Imagen pequeña, reproducible; parche de seguridad de Node 22.23.4 | `Dockerfile` |
| 3 | Despliegue solo por el ejecutor restringido `bd-deploy` | Aísla a los otros proyectos del servidor; gramática cerrada, política de Compose, auditoría y rollback | `deploy/executor/`, `DEPLOY.md`, `docs/DESPLIEGUE.md` |
| 4 | Contenedor de solo lectura, sin volúmenes ni env, puerto solo en `127.0.0.1:8200` | Política de la línea base de Compose | `docker-compose.prod.yml` |
| 5 | **Pagos Webpay construidos pero apagados e invisibles** | Transbank en pausa; no se cobra hasta infraestructura y afiliación | `ONLINE_CHECKOUT_UI=false` (`src/lib/plans.ts`), `docs/ACTIVACION-WEBPAY.md` |
| 6 | Persistencia de pagos en **SQLite** (`node:sqlite`) y no un servicio de base de datos | Sin dependencias nativas ni contenedores nuevos; requeriría volumen + `accept-compose` al activarse | `src/lib/payments/`, `docs/PAGOS-SQLITE.md` |
| 7 | API administrativa de pagos firmada con HMAC; sin secreto, no existe (404) | Superficie mínima cuando los pagos están apagados | `src/lib/payments/adminAuth.ts` |
| 8 | Hero con **three.js** diferido, con tres niveles de degradación y CSS como base | Impacto visual sin poner WebGL en la ruta crítica; accesible y liviano | `HeroStage.tsx`, `scene.ts` |
| 9 | Escena 3D en móvil arranca con la primera interacción o 3,5 s | Reducir TBT/LCP en equipos modestos sin perder la experiencia | `HeroStage.tsx` (`start`) |
| 10 | Sin WebGL «probing» | Crear contextos de prueba era caro (TBT); si el renderer falla se cae a estático | `HeroStage.tsx` (`canRun3D`) |
| 11 | **CSS propio** (`design.css`), sin Tailwind ni CSS-in-JS | Continuidad del proyecto; control total; un solo archivo de diseño | `src/styles/design.css` |
| 12 | Revelado por scroll solo con CSS (`animation-timeline: view()`) | Sin JS ni librería de animación; se desactiva con reduced-motion | `design.css` |
| 13 | Eliminar `framer-motion` | No se usaba | `package.json` |
| 14 | **Caché del HTML con revalidación** (`max-age=0, must-revalidate`) | Causa real del «sitio sin estilos»: HTML viejo en caché del navegador apuntando a `/_next/static` ya inexistentes. Next ponía `s-maxage` de un año | `next.config.ts` |
| 15 | EmailJS con import dinámico al enviar | Sacar EmailJS del JS inicial (reduce TBT; ahorro exacto no medido por separado) | `ContactForm.tsx` |
| 16 | Precios «Desde $X + IVA» | Decisión del titular; régimen tributario por confirmar | `src/lib/plans.ts` |
| 17 | Portafolio: solo lo comprobable en sitios públicos o código propio; Logistic Control Center, Tu Farmacia Digital y Constructora MYD fuera | Sin datos, cifras ni clientes inventados; sitios no accesibles al momento | `src/lib/portfolio.ts` |
| 18 | Demo de escritorio (C#/.NET 8/Windows Forms) rotulada como demo con datos ficticios | Honestidad comercial | `demos/windows-inventory/`, `Portfolio.tsx` |
| 19 | Tecnologías como **experiencia técnica declarada**, separadas de proyectos demostrables | Pedido del titular: capacidades sin inventar casos | `TechSection`, `portfolio.ts`, `docs/CREDITOS-RECURSOS.md` |
| 20 | Logos de Simple Icons (CC0) incrustados como trazados SVG | Nítidos, sin dependencia externa; insignias propias donde no hay logo | `src/lib/techLogos.ts` |
| 21 | Fotos de **Pexels** (licencia comprobada), WebP servidos desde el propio dominio, rotuladas «ilustrativa» | Credibilidad sin presentar fotos ajenas como instalaciones de Bydlight | `public/img/stock/`, `docs/CREDITOS-RECURSOS.md` |
| 22 | **Sin videos** de stock | Licencia «Restricted» de Mixkit no verificable; no se halló video de Pexels adecuado; no agregar movimiento por agregarlo | `docs/CREDITOS-RECURSOS.md` |
| 23 | Regla ESLint `no-img-element` desactivada | WebP ya optimizado; `next/image` necesitaría `sharp` en runtime en contenedor de solo lectura | `eslint.config.mjs` |
| 24 | Eliminar «WordPress» y «Divi» de todo lo público | Requisito del titular: Bydlight es ingeniería, no agencia de plantillas | `portfolio.ts`, `blocks.tsx` |
| 25 | `overflow-x: clip` en secciones decorativas y grids con `minmax(0,1fr)` | Corrección de desbordamientos reales hallados en pruebas | `design.css` |
| 26 | `Geist Mono` sin precarga | Menos competencia por ancho de banda en el primer pintado | `src/app/layout.tsx` |
| 27 | `.claude/` en `.gitignore` | Reglas locales del ejecutor y rutas del PC no se versionan | `.gitignore` |
| 28 | Dominio público apuntado al contenedor por el **administrador** (ingress del túnel) | Cambio de Cloudflare/túnel solo con autorización; Claude solo dio comandos | fuera del repo |

## No hacer (decisiones restrictivas)

- No activar Webpay/Transbank ni crear volúmenes/variables para pagos sin autorización explícita.
- No tocar Cloudflare, túneles, DNS ni otros contenedores; no `docker system prune`, no `down -v`.
- No `accept-compose` automático; no cambiar Compose sin revisar política y línea base.
- No eludir el sandbox, las reglas `deny` ni el hook del ejecutor.
- No presentar tecnologías como casos de clientes; no inventar clientes, métricas, certificaciones ni licencias.
- No incluir «WordPress» en el sitio público.
