# Archivo del laboratorio de diseño (A/B/C/D)

Respaldo histórico de la evaluación visual de Fase 3. **No se compila ni se carga en el sitio.**
Diseño definitivo: variante D (Bydlight Signature) consolidada en `src/styles/signature.css` (Fase 4).

- `a.css`, `b.css`, `c.css`, `d.css`, `lab.css`: estilos de cada variante (anidados bajo `html[data-variant="x"]`).
- `*.txt`: código del selector, de las fuentes y del índice `/lab`, renombrado a `.txt` para que TypeScript/ESLint no lo procesen.
- Para reactivar el laboratorio en una rama de pruebas: restaurar esos archivos a `src/lab/` y `src/app/lab/`, volver a añadir el gancho de `src/app/layout.tsx` (ver `docs/LABORATORIO-DISENO-ABC.md`) y cargar las fuentes del laboratorio.
- Capturas comparativas: `docs/evidencias-diseno/comparativa/` (comparador: `index.html`).
