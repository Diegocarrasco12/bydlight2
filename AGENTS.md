# Protocolo Codex — Bydlight2

## Alcance
Trabajar exclusivamente en el repositorio Bydlight2.
No modificar otros proyectos, contenedores, servicios ni configuraciones globales.

## Flujo de desarrollo
1. Revisar el estado de Git y comprender el cambio solicitado.
2. Modificar solamente los archivos necesarios.
3. Ejecutar pruebas, lint y build disponibles.
4. Revisar diferencias y detectar secretos antes de publicar.
5. Confirmar que GitHub utiliza Diegocarrasco12/bydlight2.
6. Solicitar autorización antes de push y despliegue.

## Despliegue
Utilizar exclusivamente el cliente restringido:

powershell -NoProfile -File C:/Users/dcarrasco/.Codex/tools/bd-deploy/bd-deploy.ps1 -Op status

Operaciones permitidas: status, preflight, verify, compose-diff,
list-releases, job-status, logs, fetch, build, up, rollback.

Nunca usar SSH directo, Docker remoto, sudo remoto ni modificar
Cloudflare, el dominio público o servicios de otros proyectos.

## Publicación
1. Obtener el SHA completo del commit autorizado.
2. Confirmar push exitoso a GitHub personal.
3. Ejecutar fetch con el SHA.
4. Ejecutar preflight y revisar compose-diff.
5. Ejecutar build y esperar su finalización.
6. Solicitar autorización para up.
7. Ejecutar verify y status.
8. Informar SHA, resultado y cualquier incidencia.

Si cambia Docker Compose o la política de infraestructura,
detenerse y solicitar aprobación administrativa.
No ejecutar accept-compose automáticamente.

## Fallos
Detenerse ante errores.
No realizar rollback sin autorización.
No modificar ni reiniciar otros contenedores.
No asumir que el despliegue local en puerto 8200 actualiza
automáticamente el sitio público.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
