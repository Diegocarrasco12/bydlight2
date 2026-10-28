# Pendientes para futuras jornadas

Actualizados al cierre del 2026-10-28 (Fase 3 desplegada). **Ninguno debe ejecutarse sin que el titular lo pida**; los que tocan producción, Cloudflare o envían datos reales requieren autorización.

## Prioridad de la siguiente jornada

**SEO (publicado 2026-10-28, `5fef157`):** (a) verificar el dominio en Google Search Console (TXT en Cloudflare), enviar `sitemap.xml`, pedir indexación de las páginas prioritarias y anotar la línea base (guía en `docs/SEO_ESTRATEGIA_GOOGLE.md` §6); (b) aprobar los temas del plan editorial y crear la sección de blog (SEO Fase 4); (c) perfiles externos coherentes («Byd Light Solutions SpA») por la confusión con BYD; (d) Cloudflare «Always Use HTTPS» (`http://` responde 200), con autorización; (e) comprobar con `-Op status` / `list-releases` en PowerShell que `anterior` sea distinto de `desplegado` (rollback); (f) medir a 30/60/90 días clics, impresiones, CTR y solicitudes de cotización.

0. **Fase 3 (hero «red de nodos», ERP/SaaS):** (a) medir fps/GPU/batería del 3D en un teléfono real (el navegador automatizado limita `requestAnimationFrame`); (b) en teléfonos de ~640 px de alto el CTA principal del hero queda tras la barra inferior fija al cargar (la barra ofrece la misma acción): decidir si se ajusta; (c) retirar el código legado del átomo (`HeroStage.tsx`, `scene.ts`, reglas `.hx*` de `design.css`) tras comprobar que nada lo importa; (d) varias metadescripciones existentes superan 160 caracteres; (e) confirmar con el titular el alcance comercial de ERP/SaaS y la redacción de SAP Business One como capacidad; (f) revisar `logs` del contenedor tras el despliegue (no se pudo ejecutar el ejecutor en esta sesión después de que desapareciera el cliente).

1. **Lighthouse/PageSpeed sobre `https://bydlightsolutions.com/`** (móvil y escritorio) con HTTPS y caché reales, idealmente desde un equipo sin la inyección de Kaspersky. Comparar con
   `docs/CALIDAD_Y_PRUEBAS.md` (home móvil local 80–85, escritorio 98) y no presentar la medición local como dato de usuarios.
2. **Revisión de HSTS y CSP.** El origen no envía `Strict-Transport-Security` ni `Content-Security-Policy`. Comprobar primero si Cloudflare los agrega en el dominio público;
   evaluar dónde ponerlos (Cloudflare o `next.config.ts`). Una CSP debe permitir EmailJS, fuentes propias y los estilos/scripts en línea de Next. **No aplicar sin evaluación.**
3. **Confirmación comercial del texto «13+ años en operaciones reales»** (página Nosotros; heredado del sitio anterior). Ajustar o respaldar.
4. **Material real del portafolio:** capturas móviles de CFT Magallanes, GINFET y Angel & Eva; casos con necesidad/solución/resultado documentados por el cliente; permiso de los
   clientes para mostrar capturas (hoy no documentado en el repo). No inventar cifras, testimonios ni clientes.
5. **Prueba real del formulario de contacto** (EmailJS) con autorización del titular: hoy solo se probó interceptando la red.
6. **Diagnosticar definitivamente el código 21 del ejecutor en Claude Code** (`docs/DESPLIEGUE.md` §9). Primer paso propuesto: capturar stderr con `Start-Process -RedirectStandardError`
   desde PowerShell normal (administrador). No eludir controles de seguridad.
7. **Mejoras de rendimiento móvil** (opcional): reducir CSS/JS bloqueante de la ruta crítica, evaluar el peso del runtime en la carga inicial, revisar el coste de arranque de la escena 3D.

## Otros pendientes conocidos

- `/planes` (pre-existente): Lighthouse reportó `heading-order` (accesibilidad 98). Corregir el orden de encabezados.
- `public/og-image.png`: regenerar con la identidad nueva (no se verificó su contenido actual).
- Régimen tributario/IVA de los precios «Desde $X + IVA» (`IVA_LABEL`, `PRICE_NOTE` en `src/lib/plans.ts`).
- Videos: solo si se aporta material propio o con licencia verificable (la licencia «Restricted» de Mixkit no se pudo comprobar).
- Evidencia de proyectos para tecnologías declaradas (Python, Java/Spring Boot, PHP, Flutter, SQL Server, PostgreSQL, MySQL, Windows Server/IIS, SAP Business One Service Layer): hoy son
  **capacidades**, no casos demostrables; añadir casos solo con respaldo y permiso del cliente.
- Transbank/Webpay: en pausa. Reanudar requiere afiliación, documentos de Transbank, infraestructura (volumen + configuración) y `accept-compose` (`docs/ACTIVACION-WEBPAY.md`).
- Proyectos excluidos del portafolio por decisión previa: Logistic Control Center, Tu Farmacia Digital (dominio sin resolver al momento) y Constructora MYD (503 al momento). Reevaluar.
- Revisión visual manual de todas las páginas internas en todos los anchos (hoy solo comprobación automática de desbordes más capturas selectivas).
- Pruebas del ejecutor (`cd deploy/executor && python -B -m unittest discover -s tests`): reejecutar si cambia algo en `deploy/`.
- `DEPLOY.md` §8 describía pasos ya completados; se actualizó el 2026-10-27, pero revisar el resto de la guía si se reinstala el ejecutor.
- Limpieza opcional: `tsconfig.tsbuildinfo` ahora en `.gitignore`; `public/img/logos/logo1,3,4,5,6.png` parecen sin uso (no verificado).

## No son pendientes (decisiones cerradas)

Webpay seguirá apagado; WordPress no vuelve; no se purga Cloudflare; no se modifican el túnel ni el DNS desde aquí.
