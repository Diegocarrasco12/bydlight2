# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, `eslint-config-next`)

There is no test suite.

## Architecture

Byd Light Solutions corporate site (Spanish-language, `lang="es"`): Next.js 16 App Router + React 19 + TypeScript, plain CSS (no Tailwind/CSS-in-JS), `framer-motion` for animation. No backend or API routes.

- `src/app/layout.tsx` wraps every page with `Navbar` and `Footer` and loads Geist fonts; global styles come from `src/app/globals.css`. Note `src/styles/globals.css` is **not imported anywhere** (dead file) — edit the one in `src/app/`.
- Routes (`src/app/{contacto,servicios,proyectos,nosotros}/page.tsx`) are thin; the home page composes section components from `src/components/<name>/` (hero, services, projects, process, trust, cta, contact...).
- Each component folder pairs the component with a same-named `.css` file imported directly by the component. Route-level pages have their own css (e.g. `contacto/contacto.css`). CSS is global (not modules, except `page.module.css`), so class names must stay unique across files.
- Components are a mix of `.tsx` and `.jsx`.
- Contact form (`src/app/contacto/page.tsx`) sends mail client-side via `@emailjs/browser` `sendForm`; EmailJS service/template/public key are configured in that file, not via env vars.
- Media assets live in `public/videos` (hero/demo background videos) and `public/img`.

## Infraestructura de servidor y despliegue

Este proyecto se despliega en el **servidor Ubuntu personal del usuario**, con el mismo modelo que `C:\Users\dcarrasco\Desktop\Proyectos\projectmanager` (leer su `DEPLOY.md`, `CLAUDE.md` y `deploy/` como referencia antes de crear nada de infraestructura aquí). Es un **proyecto independiente**: no se rige por la arquitectura de deploy de faret (`workspacefaret`) ni debe compartir con él ni con otros proyectos del servidor contenedores, redes, volúmenes, secretos, túnel ni puertos.

Patrón heredado de projectmanager (adaptar, no copiar a ciegas; este sitio no tiene backend, base de datos ni Redis):

- Proyecto Docker propio (`docker compose -p <proyecto>`), con directorio propio en `/srv/<proyecto>/` (`app/` = clon sin secretos, `secrets/` 700 con `.env` 600, `backups/`), redes y volúmenes con ese prefijo.
- Sin proxy propio ni puertos 80/443 públicos: el contenedor publica un único puerto solo en `127.0.0.1` y un Cloudflare Tunnel (`cloudflared` en el host, TLS en Cloudflare) lo expone. Subdominios de un solo nivel.
- Despliegue vía ejecutor restringido (`oe-deploy`/`oe-gate`, usuario sin sudo ni docker, deploy key de solo lectura en GitHub), no con SSH admin desde Claude. Reglas `ask` para operaciones en producción.
- Nunca `prune`, `down -v` ni tocar otros proyectos del servidor. Desplegar solo con orden expresa del usuario en el chat.
- Seguridad del repo: no versionar `.env`, dominios/IPs/IDs de túnel reales ni datos de infraestructura; usar placeholders (`<SERVER_HOST>`, `<CLOUDFLARE_TUNNEL_NAME>`...). Revisar `git status`/`git diff` antes de commitear y usar `git add <archivo>`.

Implementado (2026-10-26, preparado localmente; **nada instalado ni desplegado aún**): `Dockerfile` + `docker-compose.prod.yml` (Next.js `output: "standalone"`, proyecto Docker `bydlight-prod`, solo `127.0.0.1:8200`), ejecutor independiente `bd-deploy` en `deploy/executor/` (`bd-gate` → `sudo bd-run`, política, línea base de compose con `accept-compose` aprobado por humano, rollback de imágenes, instalador transaccional `--plan/--apply/--verify` con reversión verificada y sudoers explícito por forma de petición; auditado, 129 pruebas) y cliente `deploy/executor/claude-code/bd-deploy.ps1`. Guía completa y pasos de instalación en `DEPLOY.md`.

- Pruebas del ejecutor (sin servidor): `cd deploy/executor && python -B -m unittest discover -s tests`. Si cambia `docker-compose.prod.yml`, regenerar `tests/fixtures/prod.json` (la prueba `test_fixture_coincide...` lo exige) y revisar `compose-diff`.
- Operaciones: `status preflight verify compose-diff list-releases job-status logs` (lectura); `fetch build up rollback accept-compose` (modifican; reglas `ask`). Nunca desplegar sin orden expresa del usuario.
- Los scripts de `deploy/` y los Dockerfile deben mantener finales LF (`.gitattributes`).
- Los valores reales (host SSH, dominio, túnel, usuario de GitHub) los define el usuario; no inventarlos ni versionarlos.
