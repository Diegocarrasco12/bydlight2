# Laboratorio de diseño visual A/B/C/D (Fases 3, 3.1 y 3.2)

> **ESTADO (Fase 4): laboratorio RETIRADO.** El titular aprobó la variante **D · Bydlight Signature** como diseño definitivo; está consolidada en `src/styles/signature.css` y es el diseño por defecto. El selector, la ruta `/lab`, `src/lab/` y el gancho del layout ya no existen en el código; el respaldo (estilos A/B/C/D y código del selector como `.txt`) está en `docs/archivo-laboratorio/` y las capturas en `docs/evidencias-diseno/comparativa/`. Las instrucciones de las secciones 1 y 2 describen el laboratorio tal como fue y **ya no se aplican**. Ver `docs/FASE4-CONSOLIDACION-SIGNATURE-WEBPAY.md`.

Estado: **solo desarrollo local**. Sin commit, sin push, sin despliegue. El diseño productivo por defecto no cambia.
No se tocó la lógica de pagos, endpoints, credenciales, persistencia, devoluciones ni reglas de certificación: solo presentación.

## 1. Cómo usarlo

- Servidor de desarrollo: `npm run dev` → http://localhost:3000
- Comparador visual A/B/C/D (archivo local, ábrelo directamente en el navegador): `docs/evidencias-diseno/comparativa/index.html`
- Índice del laboratorio: **http://localhost:3000/lab** (enlaces a todas las páginas y a las órdenes de ejemplo)
- Cambiar de variante conservando la página y el scroll: selector flotante **◐ Lab** (abajo a la izquierda), o atajos `Alt+0` (original), `Alt+1` (A), `Alt+2` (B), `Alt+3` (C), `Alt+4` (D · Bydlight Signature).
- La variante se guarda en la cookie `bd-variant` y se aplica como `<html data-variant="a|b|c">`. Sin cookie = diseño actual.
- Órdenes de ejemplo para las pantallas de pago (base SQLite de pruebas, doble del SDK de Transbank, sin red ni cobros):
  `PAYMENTS_DB=<archivo de pruebas> node --import ./tests/register.mjs scripts/lab-seed.mjs` y arrancar el dev server con las mismas `PAYMENTS_DB`/`PAYMENTS_CONFIG`.
- Nota: `/orden/*` limita a 40 consultas por IP cada 10 min; para barridos automáticos se varió `x-forwarded-for` (solo local).

## 2. Cómo está aislado

| Aspecto | Implementación |
|---|---|
| Carga | `src/app/layout.tsx` importa `src/lab/server` solo si `NODE_ENV !== "production"` (código muerto en producción) |
| Estilos | `src/lab/{a,b,c}.css`, anidados bajo `html[data-variant="x"]`; no alteran `design.css` |
| Tipografías | `next/font/google` (autoalojadas; licencia SIL OFL 1.1, uso comercial permitido) |
| `/lab` | `notFound()` en producción |
| Hero 3D | `HeroNetwork` no se ejecuta en A, B y C (el hero se rediseña por CSS); **en D y en el diseño actual se conserva la escena 3D**. La comprobación está dentro de `if (process.env.NODE_ENV !== "production")`, así que no existe en el build |

Verificado con `npm run build`: el resultado (`.next/static`, `.next/server`) no contiene `bd-variant`, `data-lab-ui`, variables de fuentes del laboratorio ni «Instrument Serif»; `/`, `/planes`, `/servicios`, `/proyectos`, `/nosotros`, `/contacto` siguen estáticas (○); `/lab` responde 404 con `next start`; con cookie `bd-variant=b` el `<html>` de producción no lleva `data-variant`.

## 3. Las tres propuestas

El logotipo original tiene el texto claro, por lo que cabecera, pie y bandas destacadas se mantienen oscuras en las tres. No se modificó el logotipo.

### A · Minimalismo tecnológico
- Concepto: máxima sobriedad; todo se reduce a texto, aire y filetes de 1 px. Hero centrado solo con texto. Inspirado en herramientas de producto tipo Linear.
- Tipografía: Space Grotesk (títulos, peso 500) + Inter (texto).
- Paleta: fondo `#08090b`, línea `rgba(255,255,255,.07/.13)`, texto `#f1f2f4`, apagado `#8d919b`, acento `#5b8cff`.
- Rasgos: botón primario blanco sobrio (radio 9), tarjetas con filete, secciones de 148 px de relleno, precios tabulares.

### B · Editorial tecnológico
- Concepto: publicación de estudio; cuerpo en papel cálido, bandas de tinta azul noche, un único acento bermellón, secciones numeradas, listas con filetes en lugar de tarjetas, fotografía monocroma con pie de figura.
- Tipografía: Instrument Serif (titulares, cursiva para el énfasis) + IBM Plex Sans (texto) + IBM Plex Mono (rótulos).
- Paleta: papel `#f4f0e7` / `#ebe6da`, tinta `#15130f`, noche `#0d111b`, azul `#2447c4`, bermellón `#d4540b`, verde estado `#1f7a4c`.
- Rasgos: botones rectangulares, campos solo con línea inferior, comprobante como recibo (filetes discontinuos).

### C · Ingeniería premium
- Concepto: panel de control de infraestructura; negro grafito con retícula visible, celdas con filete compartido, estados con indicador, cifras en monoespaciada. Inspirado en plataformas para desarrolladores (sin copiarlas).
- Tipografía: Manrope (títulos y texto) + IBM Plex Mono (rótulos, precios, datos).
- Paleta: `#050608` / `#0a0c10` / `#10131a`, texto `#f5f6f8`, azul `#3b82ff`, cian `#5ec8ff`, verde estado `#3ddc97`, ámbar `#f5a524`.
- Rasgos: tarjeta decorativa de «estado» en el hero (texto fijo, sin cifras), plan recomendado con borde cian, comprobante con barra lateral de estado.

### D · Bydlight Signature (Fase 3.2: ~70 % A + ~30 % C)
- Concepto: la sobriedad de A como base y la precisión de C solo donde refuerza el contenido; sin aspecto de panel administrativo ni de terminal. **Conserva el hero cinematográfico con la escena 3D** (decisión del titular); solo se afinan su tipografía, etiqueta y botones.
- Implementación: `src/lab/d.css` reutiliza los tokens y componentes de A (el primer selector de `a.css` pasó a `html[data-variant="a"], html[data-variant="d"]`; las reglas del hero de A quedaron acotadas a `&[data-variant="a"]` y A se ve igual, comprobado) y sobrescribe lo propio. No se añadieron dependencias ni páginas duplicadas.
- Tipografía: Space Grotesk 500 (títulos), Inter 400–500 (texto), IBM Plex Mono solo en rótulos, cifras de planes y detalles técnicos (nunca en párrafos).
- Paleta: fondo `#07090d` (azul negro), superficies `#0a0d13`/`#10141c`, texto `#eef0f3`, secundario `#8f95a1`, bordes blancos al 7,5 % y 15 %, acento **naranja Bydlight `#ff7a1a`** (`#ffab70` en hover y texto), verde `#5dd39e` y rojo `#ff7b7b` solo para estados.
- Toque de ingeniería (C): secciones numeradas (`01 /`, `02 /`) con filete y marca naranja corta, rótulos en mono, capacidades y servicios como lista con filete y número (sin tarjetas), indicador de estado en las etiquetas, tabla de planes con cabeceras mono.
- Uso del naranja: botón principal, marca de sección, pestaña activa, plan recomendado (filete superior y etiqueta), paso activo del flujo. No hay contornos naranjas en tarjetas.
- Cotización y pagos: resumen en filas con etiqueta mono y cifras tabulares (anticipo y saldo en filas propias), pasos del flujo en mono, resultados con barra lateral de estado (verde aprobado, rojo rechazado, naranja pendiente/aviso) sin rellenos de color, comprobante en filas con filetes; en móvil las filas se apilan (etiqueta sobre valor) para que nada se parta.
- Textos: se conserva el contenido comercial aprobado. Propuesta para revisión (no aplicada): reforzar en el subtítulo del hero «automatización e integración de sistemas», ya presentes en los servicios.
- Límite conocido: la fotografía del hero y la escena 3D conservan su tono azul aprobado, por lo que el naranja convive con ese azul en el hero.

## 4. Problemas visuales que se atacan

Tarjetas pegadas → separación 20–72 px según variante; exceso de bordes → A: filete único, B: sin tarjetas, C: bordes compartidos; titulares pesados → pesos 400–600 con interlineado ajustado; secciones poco diferenciadas → ritmo claro/oscuro (B) o bandas con fondo distinto (A, C); jerarquía → escala tipográfica y rótulos propios; formularios densos → más espacio, etiquetas pequeñas, enfoque visible; botones estridentes → una sola jerarquía primario/ghost sobria; brecha escritorio/móvil → cada variante trae su bloque `@media (max-width: 900px)`.

## 5. Resultados de pruebas

Pruebas automáticas y comprobaciones (4-nov-2026):
- `npm test`: 40/40 correctas. `npx tsc --noEmit`: sin errores. `npm run lint`: sin avisos. `npm run build`: correcto.
- Desbordamiento horizontal (Playwright, `scrollWidth ≤ clientWidth`): **sin casos** en 3 variantes × 5 viewports (1920×1080, 1366×768, 768×1024, 390×844, 360×800) × 9 páginas (home, servicios, detalle de servicio, planes, proyectos, detalle de proyecto, nosotros, contacto, contratar) = 135 combinaciones, más 105 combinaciones de las 7 órdenes de ejemplo (solicitada, cotizada, aprobada, rechazada, cancelada, pendiente, error). Todas responden 200.
- Capturas reales en `docs/evidencias-diseno/cmp-<página>-<variante>-<ancho>.png` (30 imágenes: home, planes, servicios, proyectos, contacto, contratar y comprobante de orden; escritorio y móvil).
- Tipografías comprobadas por estilo computado (Space Grotesk/Inter, Instrument Serif, Manrope).

Pendiente o no cubierto (honestidad de alcance):
- La revisión visual detallada se hizo sobre una parte de las capturas (planes, comprobante, hero); el resto está generado pero conviene que el titular lo revise.
- No se midió el contraste con herramienta (WCAG); se usaron tokens de alto contraste, pero B-papel (`#5d594f` sobre `#f4f0e7`) y C (`#9aa0ad` sobre `#050608`) deberían auditarse con axe/Lighthouse.
- El formulario alojado de Webpay (Transbank) no es estilable; solo se rediseñan las pantallas propias.
- La consola del navegador muestra errores en desarrollo (no analizados a fondo; no atribuibles a las variantes sin revisar).
- Mediciones de rendimiento no realizadas (el laboratorio carga seis fuentes solo en desarrollo).

## 6. Pros y contras

| | A | B | C |
|---|---|---|---|
| A favor | Coherente con el tono actual; mínimo riesgo; muy legible; rápido de portar | Identidad más distintiva; jerarquía editorial clara; cuerpo claro descansa la lectura | Transmite rigor técnico; buena densidad de datos (planes, estados, APIs); cohesión con el hero actual |
| En contra | Menos memorable; puede parecerse a otras webs SaaS | Mayor cambio de marca; serifa y cuerpo claro se alejan del logo; más trabajo de contraste y de imágenes | Riesgo de verse «genérico dev-tool»; retícula y brillos exigen cuidado en móvil y rendimiento |
| Pagos | Comprobante limpio y neutro | Comprobante tipo recibo, muy claro | Estados con barra de color, fáciles de escanear |
| Fuentes | 2 familias | 3 familias (la serifa añade peso) | 2 familias |

## 6 bis. Pruebas de la variante D (Fase 3.2)

- `npm test` 40/40, `npx tsc --noEmit` sin errores, `npm run lint` sin avisos, `npm run build` correcto.
- Exclusión del laboratorio en el build: ni `.next/static` ni el JS de `.next/server` contienen `bd-variant`, `data-lab-ui`, `dataset.variant` ni las fuentes del laboratorio (solo el mapa de fuentes del servidor, que no se sirve, incluye el texto de `HeroNetwork.tsx`); `/lab` responde 404 en producción.
- D: sin desbordamiento horizontal en 5 tamaños × 16 páginas (9 páginas + 7 órdenes de ejemplo = 80 combinaciones), todas 200; menú móvil abre con 7 enlaces; escena 3D activa (`hn--gl`) igual que en el diseño actual.
- Capturas de D: `docs/evidencias-diseno/comparativa/<página>/<ancho>[-completa]-d.png` y `menu-movil/390-d.png`; las capturas de A, B y C no se alteraron.
- Incidencia previa documentada: el límite de 40 consultas/10 min de `/orden/*` hace que un barrido rápido devuelva 404 desde la misma IP; no es un fallo de las variantes.
- No evaluado: contraste con herramienta (WCAG) y rendimiento; el texto secundario `#8f95a1` sobre `#07090d` debería auditarse.

## 7. Recomendación técnica (sin elegir ganador)

- Si prima **continuidad y bajo riesgo**: A.
- Si prima **diferenciación de marca** ante clientes empresariales y se acepta rehacer el criterio de imagen y color: B.
- Si prima **credibilidad técnica y presentación de planes/estados**: C.
- D materializa la combinación A + C con acento naranja de marca y conserva el 3D; queda a evaluación del titular frente a A y C. Cualquier elección requiere portar los estilos a `design.css`/tokens, auditar contraste y rendimiento, y decidir qué hacer con la foto de stock del hero (siempre rotulada como ilustrativa).

## 8. Archivos del laboratorio

Nuevos: `src/lab/{a,b,c,d,lab}.css`, `src/lab/{fonts.ts,server.tsx,LabSwitcher.tsx}`, `src/app/lab/page.tsx`, `scripts/lab-seed.mjs`, `docs/evidencias-diseno/*`, este documento.
Modificados: `src/app/layout.tsx` (gancho de laboratorio solo en desarrollo), `src/components/hero/HeroNetwork.tsx` (en desarrollo, no ejecuta 3D en A/B/C; D lo conserva), `src/lab/{server.tsx,LabSwitcher.tsx,a.css}` y `src/app/lab/page.tsx` (alta de D; en `a.css` solo el selector inicial y el alcance de las reglas del hero).
