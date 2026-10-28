# Documentación técnica — Fase 3 (hero «red de nodos», ERP/SaaS, fotografía)

Versión desplegada: `67287c08d1f57c327aa22aa888a8a301df781b0d` (2026-10-28). Rollback: `56fdcf1cb6e05632a5425272dc3603364d0ec0cd`.
Complementa `ARQUITECTURA.md` (visión general), `DECISIONES_TECNICAS.md`, `FASE2_PROTOTIPOS.md` (historia y mediciones) y `CREDITOS-RECURSOS.md` (fotos).

## 1. Mapa de archivos

| Archivo | Rol |
|---|---|
| `src/app/page.tsx` | Portada. Orden: `JsonLd` → `HeroNetwork` → `EnterpriseBand` → `Capabilities` → `InfraBand` → `ProjectsShowcase` → `ApiSection` → `Method` → `TechSection` → `PlansTeaser` → `HomeContact` |
| `src/components/hero/HeroNetwork.tsx` | Componente cliente del hero: HTML + SVG de respaldo + `<canvas>`; decide cuándo y si arrancar la escena |
| `src/components/hero/scene-network.ts` | Escena three.js; se importa dinámicamente, nunca en el bundle inicial |
| `src/components/hero/HeroStage.tsx`, `scene.ts` | **Legado** (átomo). Ninguna ruta los importa. Retirar junto con `.hx*` de `design.css` |
| `src/components/home/enterprise.tsx` | `Photo`, `EnterpriseCards`, `EnterpriseBand` (portada), `ServicesByCategory` (`/servicios`) |
| `src/lib/services.ts` | Datos de los 10 servicios, categorías (`SERVICE_GROUPS`) y fotos (`PHOTOS`) |
| `src/components/navbar/Navbar.tsx` | Mega-menú de servicios por categoría (escritorio) y sub-enlaces ERP/SaaS en la hoja móvil |
| `src/styles/fase2.css` | Estilos nuevos (`.hn*`, `.ent-*`, `.sv-photo`, `.sv-ben*`, `.sv-scope`, mega-menú). Se importa en `layout.tsx` después de `design.css` |
| `src/styles/design.css` | Solo un cambio: `.bd-sheet` con `overflow-y:auto` y animación movida a `.bd-sheet-item` |
| `public/img/stock/*.webp` | 12 archivos (6 fotos × 640/1280 px) de la Fase 3, 18–72 KB cada uno |

## 2. Hero: ciclo de vida

1. **Servidor:** se entrega el HTML con titular, subtítulo, CTA, chips y la red SVG (`NetworkFallback`). El LCP no depende de WebGL.
2. **Montaje (`useEffect`):**
   - Lee `prefers-reduced-motion` y evalúa `canRun3D()`: falso con `saveData`, `hardwareConcurrency < 4`, `deviceMemory < 4` o sin `WebGLRenderingContext`. Si es falso, se queda el SVG.
   - `mobile = matchMedia("(max-width: 900px)")`.
   - Espera la primera interacción (`scroll`, `touchstart`, `pointerdown`, `pointermove`, `keydown`) o 3,5 s, y luego `requestIdleCallback` (timeout 1,5 s; respaldo `setTimeout` 500 ms).
3. **`boot()`:** `import("./scene-network")` → `createNetworkScene({canvas, mobile, still, onLost, cancelled})`.
   - Si devuelve un manejador, se añade la clase `hn--gl` (el canvas pasa a opacidad 1 y el SVG a 0, con transición de 0,9 s) y se enlazan `ResizeObserver` e `IntersectionObserver` (`rootMargin: 80px`).
   - `onLost` (pérdida de contexto) quita `hn--gl` y vuelve al SVG. Un error en la importación hace lo mismo.
4. **Desmontaje:** `cancelled = true`, se retiran listeners y temporizador, se desconectan los observadores y se llama `handle.dispose()`.
   Si el desmontaje ocurre mientras la escena se construye, `createNetworkScene` libera todo y devuelve `null`; si ya terminó, el componente llama `dispose()`.

## 3. Escena (`scene-network.ts`)

- **Geometría:** nodos como `InstancedMesh` (46 en escritorio, 30 en móvil; 4 «hubs»), conexiones a los vecinos más cercanos como un cilindro instanciado; 2 llamadas de dibujo en total.
- **Pulsos:** un único `Points` con shader aditivo (34 en escritorio, 16 en móvil; cola de 3 puntos), más brillo en los hubs y polvo de partículas.
- **Materiales:** `MeshPhysicalMaterial` en escritorio, `MeshStandardMaterial` en móvil. Tintes de nodos `#2f3a52 #38445f #28324a #3f4c69`; hubs `#55617e`; acentos cian `#5ee6ff` y naranja `#ff7a1a`.
- **Iluminación:** `RoomEnvironment` + PMREM (entorno procedural, sin HDRI descargado), `scene.environmentIntensity = 0.85`, tone mapping ACES y niebla. Sin sombras dinámicas.
- **Encuadre:** radio de ajuste de cámara 3,7 (móvil) / 4,3 (escritorio).
- **Coste acotado:** tope de DPR 1,5 (móvil) / 1,75 (escritorio); tope de cuadros 30 fps (móvil) / 45 fps (escritorio); el bucle se pausa fuera de pantalla (`setVisible`) y con la pestaña oculta (`visibilitychange`).
- **Construcción sin bloquear:** se arma en tareas cortas con cesión al navegador (`setTimeout`), comprueba `cancelled()` entre pasos y compila shaders con `renderer.compileAsync` (en `try/catch`).
- **`still` (reduced motion):** se coloca la escena en una pose fija y se dibuja un solo cuadro; no hay bucle.
- **API devuelta:** `{ setVisible(v), resize(), dispose() }`. `dispose` libera geometrías, materiales, texturas del entorno y el renderer.

## 4. Maquetación del hero

Grilla con áreas `head / stage / actions` (`.hn-head`, `.hn-stage`, `.hn-actions`), sin scroll pegajoso.
- Escritorio: titular y acciones a la izquierda, escenario a la derecha. Titular `clamp(2.7rem, 4.5vw, 4.7rem)`.
- Móvil (≤ 900 px): el 3D tiene su propio bloque entre el titular y los botones; CTA a ancho completo.
- Pantallas bajas (`max-width:900px` y `max-height:720px`): composición compacta. Limitación conocida: a ~640 px de alto el CTA principal queda tras la barra inferior fija al cargar.

## 5. Servicios y datos

- `Service` añade `line` (`"empresa" | "ingenieria" | "web"`), `photo?`, `benefits?` y `scopeNote?`. Para agregar un servicio basta una entrada en `SERVICES`: la página `[slug]`, el listado, el sitemap (`src/app/sitemap.ts`) y el JSON-LD (Service, BreadcrumbList, FAQPage) se generan solos.
- Servicios nuevos: `soluciones-erp` y `soluciones-saas`, con `planIds: ["software"]` y una `scopeNote` que aclara que **no se comercializa un ERP ni un SaaS propio**. SAP Business One y Service Layer figuran solo como capacidad técnica, sin clientes ni certificaciones.
- Total: 10 servicios (`soluciones-erp`, `soluciones-saas`, `desarrollo-web`, `ecommerce`, `software-a-medida`, `arquitectura-de-software`, `aplicaciones-moviles`, `integraciones-y-apis`, `automatizacion-de-procesos`, `mantenimiento-web`); el sitemap pasa de 19 a 21 URL.
- Fotos: `PHOTOS` define archivo, texto alternativo y dimensiones; `photoSrc`/`photoSrcSet` construyen `/img/stock/<archivo>-{640|1280}.webp`. Toda foto se rotula «Imagen ilustrativa · Pexels».
- `/servicios/[slug]`: banda `.sv-photo`, cuadrícula de beneficios, aviso de alcance y etiqueta superior para la línea «empresa». `/nosotros`: banda fotográfica con la aclaración «No corresponde a personas ni oficinas de Byd Light Solutions».

## 6. Navegación

- Escritorio: panel `.bd-mega` dentro de `.bd-has-mega`, abierto con `:hover` y `:focus-within` (CSS puro, accesible por teclado).
- Móvil: la hoja `.bd-sheet` tiene envoltorios `.bd-sheet-item` y sub-enlaces `.bd-sheet-sub` a ERP y SaaS; con `overflow-y:auto` para pantallas bajas.

## 7. Cómo verificar (reproducible)

```
npm ci && npm test && npx tsc --noEmit && npm run lint && npm run build   # luego: git checkout next-env.d.ts
```
- Regresión del átomo: en `/` debe existir `.hn` y no debe existir `.hx`, en entrada directa, recarga y clic en el logo, en escritorio y móvil (se comprobó en producción a 1440 y 390 px).
- Lighthouse 12 local (`next start`): bloquear el script de Kaspersky con `--blocked-url-patterns="*kaspersky-labs.com*"`. Resultados y método en `FASE2_PROTOTIPOS.md`; son datos de laboratorio.
- Si aparecen errores de tipos por rutas borradas tras eliminar páginas, borrar `.next` antes de compilar.

## 8. Despliegue de esta fase

Flujo: `status → fetch → preflight → compose-diff → build → job-status → up → verify → status`. Detalle y resultado del 2026-10-28 en `DESPLIEGUE.md`.
El `build` es asíncrono: devuelve un id y se consulta con `job-status <id>`. Docker Compose no cambió (política CUMPLE, línea base igual).

## 9. Riesgos y deuda técnica

- Código legado del átomo sin uso (`HeroStage.tsx`, `scene.ts`, `.hx*`): retirar tras confirmar que nada lo importa.
- fps/GPU/batería del 3D sin medir en teléfono real.
- CTA del hero tras la barra fija en teléfonos de ~640 px de alto.
- Algunas metadescripciones anteriores superan 160 caracteres; `/planes` con salto de encabezados (pre-existentes).
- Fotos de stock: ilustrativas, sin respaldo de personas ni marcas retratadas (restricción de la licencia Pexels).
