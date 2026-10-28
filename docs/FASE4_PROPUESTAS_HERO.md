# Fase 4 — Propuestas para el hero de escritorio (prototipos, sin desplegar)

Estado: **prototipos locales, sin commit, sin push, sin despliegue**. Producción sigue en `67287c0`. Las rutas `/lab/hero/*` existen solo en el árbol de trabajo.

## 1. Diagnóstico del hero actual (escritorio)
Medido sobre las capturas de producción en 1366, 1440 y 1920 px (`docs/fase4-capturas/actual-*.png`):
- **La escena ocupa ~28 % del ancho** (columna derecha de la grilla, cuadrada y con `max-height: 78svh`). A 1920 px quedan ~900 px de fondo plano a cada lado.
- **El fondo no aporta**: dos degradados radiales y una rejilla de 64 px al 35 % de opacidad que casi no se ve; no hay profundidad, horizonte ni referencia de escala.
- **Los nodos flotan sin contexto**: no hay suelo, sombra ni reflejo, y el contraste con el fondo es el único anclaje.
- **Materiales**: esferas de acero oscuro con un entorno de estudio genérico (`RoomEnvironment`): reflejos pequeños y pocas variaciones de acabado; los 46 nodos usan el mismo material, y las conexiones son líneas finas de un solo grosor.
- **Movimiento**: giro rígido del conjunto; los nodos no se mueven entre sí.
- **Composición**: texto a la izquierda y objeto a la derecha con aire en todos lados: parece "texto + adorno".

## 2. Qué se probó (comparten escena y estructura)
Mismo texto, botones y estructura que producción (`HeroLab.tsx` copia `HeroNetwork.tsx`). En escritorio el canvas cubre toda la sección y la red se corre a la derecha según el aspecto. **En móvil las tres cargan la escena aprobada de producción sin cambios** (comprobado: en 390 px la única diferencia de píxeles con producción está en el cuadro del 3D, que se anima).

Mejoras de la escena común (`scene-lab.ts`):
- **Entorno de estudio propio** (PMREM) con cajas de luz de forma y temperatura distintas: reflejos alargados reconocibles sobre el metal.
- **Tres acabados PBR**: cromo pulido (concentradores), acero y aluminio anodizado grafito, con `roughness` y `clearcoat` distintos.
- **Escala**: 5 concentradores, nodos medios y muchos pequeños; anillos de ingeniería finos en los concentradores; cables con grosor según el tipo de enlace.
- **Movimiento orgánico**: cada nodo deriva de forma independiente; los cables se recalculan en vivo.
- **Costo acotado**: nodos, anillos y cables son `InstancedMesh`; pulsos y LEDs son `Points`; sin sombras ni postprocesado; esfera fina solo en concentradores (esfera ligera en el resto y en el reflejo).

| | Idea | Fondo |
|---|---|---|
| **A · Cinematic Metal Network** | Toma de producto: la red flota sobre un suelo de vidrio oscuro con **reflejo real** (los mismos buffers espejados) y un charco de luz azul | Degradados volumétricos; bokeh lejano muy tenue |
| **B · Immersive Data Environment** | La red dentro de un **pasillo de centro de datos 3D**: racks instanciados con textura, barras de luz con perspectiva y reflejo en el suelo, LEDs de estado, fondo luminoso | Todo en 3D real |
| **C · Enterprise Technology Cinematic** | Red 3D sobre **fotografía real de centro de datos** (`centro-de-datos-1920.webp`, ya en el sitio) gradada a azul/naranja de marca, con velo lateral para el texto | Foto + degradados; rotulada «Imagen ilustrativa · Pexels» |

## 3. Mediciones
Banco: Chromium de Playwright, build de producción local (`next start`), 1440×900 (y 1920×1080), 3 repeticiones (2 a 1920), ventana de 8 s tras iniciar el 3D.
**Limitación importante:** este equipo renderiza WebGL por **software** (SwiftShader); el proceso GPU usa ~11–14 núcleos. Los fps absolutos **no representan una GPU real ni un teléfono**; solo sirven para comparar el costo relativo entre propuestas en las mismas condiciones. **No hay medición en GPU real.**

| | fps (software) | vs actual | Llamadas de dibujo | Triángulos | Hilo principal | JS cargado |
|---|---|---|---|---|---|---|
| Actual | 7,1 | 100 % | 5 | n/d | 2,1 % | 273 KB → 398 KB con 3D |
| A | 4,1 | 58 % | 15 | 102 mil | 1,7 % | 273 KB → 399 KB |
| B | 1,5 | 21 % | 19 | 49 mil | 1,0 % | 273 KB → 399 KB |
| C | 5,2 | 73 % | 8 | 55 mil | 1,8 % | 273 KB → 399 KB |
| 1920×1080 | actual 7,5 · A 3,5 · B 1,1 · C 4,5 | | | | | |

Lectura:
- El **JS es prácticamente idéntico** al actual (la escena nueva reemplaza a la antigua en el mismo chunk dinámico) y el **hilo principal casi no trabaja** en ninguna: el costo es de rasterizado.
- Los prototipos pintan **~2,6 veces más píxeles** (canvas de pantalla completa), así que A y C cuestan menos por píxel que el actual; B cuesta más (capas aditivas grandes y niebla).
- C añade una imagen de ~348 KB (WebP 1920 px, `fetchpriority=low`), que no estaba en la portada.
- Antes del nivel de detalle, A tenía 292 mil triángulos (fps 2,1); bajó a 102 mil (fps 4,1).
- Sin errores de consola ni desbordes horizontales en ningún tamaño.

**Legibilidad** (fondo detrás del texto, sin el texto, medido por píxel; peor 5 % más claro; contraste WCAG): subtítulo ≥ 6,7:1 y titular ≥ 15,8:1 en las tres propuestas (actual ≥ 7,5:1 y ≥ 17,8:1). Medido antes del último desplazamiento de la red hacia la derecha, que la aleja del texto. Nota: en B una barra de luz del techo pasa por detrás del titular (queda bajo el velo, pero distrae).

**Accesibilidad / degradación**: se conservan `aria-hidden` en el escenario, el titular y los CTA como HTML desde el primer byte, `prefers-reduced-motion` (un solo cuadro), pausa fuera de pantalla y con pestaña oculta, y los criterios de `canRun3D()`. **Pendiente de revisar** en las propuestas: el respaldo sin WebGL de escritorio (hoy solo se ve el fondo CSS; la red SVG se omitió en el prototipo) y la prueba de reduced-motion con captura.

## 4. Recomendación
**C — Enterprise Technology Cinematic**, con la iluminación de estudio de la escena común:
- Es la que más cambia la sensación («dónde estamos») con el menor costo relativo de las tres (73 % de los fps del actual en el banco, 8 llamadas de dibujo), y el fondo se resuelve con una imagen y CSS, que degradan bien (sin WebGL queda la foto gradada).
- Riesgos: depende de una foto de stock (hay que mantener el rótulo «ilustrativa», nunca presentarla como instalaciones de Byd Light) y el peso de la imagen; conviene una versión de 1280 px para pantallas < 1600 px.
- **A** es la opción más sobria y cercana al concepto original; su reflejo de suelo es el mejor detalle de realismo y puede sumarse a C como mejora posterior.
- **B** es la más inmersiva pero la más cara (21 % de los fps en el banco) y la más difícil de mantener legible; solo con optimización adicional (menor resolución del entorno, sin MSAA) y medición en GPU real.

## 5. Archivos (todos nuevos; no se modificó ningún archivo existente)
- `src/components/hero/lab/scene-lab.ts`, `HeroLab.tsx`, `hero-lab.css`
- `src/app/lab/hero/layout.tsx` (noindex), `src/app/lab/hero/[v]/page.tsx`
- `docs/FASE4_PROPUESTAS_HERO.md`, `docs/fase4-capturas/` (capturas y hojas comparativas)

Rutas (solo locales, `noindex`): `/lab/hero/actual`, `/lab/hero/a`, `/lab/hero/b`, `/lab/hero/c`. Para verlas: `npm run build && npx next start -p 3200`. **Antes de publicar cualquier cosa hay que eliminar `src/app/lab/` y decidir el destino de `src/components/hero/lab/`.**
