"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

// Hero de la portada: red de nodos metalicos. Copia y escena conviven en una grilla normal, sin scroll pegajoso:
// en escritorio el escenario 3D va a la derecha y en movil tiene su propio bloque bajo los botones.
// Niveles: (1) escena three.js con movimiento autonomo; (2) prefers-reduced-motion: un solo cuadro 3D;
// (3) sin WebGL, ahorro de datos o equipo modesto: red estatica en SVG. El titular y los CTA son HTML desde el primer byte.

type Nav = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }

function canRun3D(): boolean {
  const nav = navigator as Nav
  if (nav.connection?.saveData) return false
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4) return false
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false
  return typeof WebGLRenderingContext !== "undefined"
}

// Red estatica decorativa (respaldo y marcador de posicion mientras carga la escena).
const FALLBACK = (() => {
  const nodes = Array.from({ length: 26 }, (_, i) => {
    const a = i * 2.399963
    const r = 0.16 + 0.8 * Math.sqrt((i + 0.5) / 26)
    return { x: 50 + Math.cos(a) * r * 44, y: 50 + Math.sin(a) * r * 36 }
  })
  const lines: [number, number][] = []
  nodes.forEach((p, i) => {
    nodes
      .map((q, j) => ({ j, d: Math.hypot(p.x - q.x, p.y - q.y) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .forEach((o) => lines.push([i, o.j]))
  })
  return { nodes, lines }
})()

function NetworkFallback() {
  return (
    <svg className="hn-fallback" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <g stroke="#5ee6ff" strokeOpacity="0.28" strokeWidth="0.25">
        {FALLBACK.lines.map(([a, b], i) => (
          <line key={i} x1={FALLBACK.nodes[a].x} y1={FALLBACK.nodes[a].y} x2={FALLBACK.nodes[b].x} y2={FALLBACK.nodes[b].y} />
        ))}
      </g>
      {FALLBACK.nodes.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i % 9 === 0 ? 1.9 : 1} fill={i % 9 === 0 ? "#ff7a1a" : "#2a3652"} stroke="#5ee6ff" strokeOpacity="0.5" strokeWidth="0.2" />
      ))}
    </svg>
  )
}

export default function HeroNetwork() {
  const root = useRef<HTMLElement | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const el = root.current
    const st = stage.current
    const cv = canvas.current
    if (!el || !st || !cv) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!canRun3D()) return // queda el SVG estatico

    let cancelled = false
    let handle: import("./scene-network").NetworkHandle | null = null
    let io: IntersectionObserver | null = null
    let ro: ResizeObserver | null = null
    const mobile = window.matchMedia("(max-width: 900px)").matches

    // La escena arranca con la primera interaccion (o a los 3,5 s), con el navegador ocioso y despues del primer pintado:
    // el titular, los botones y la red estatica no compiten con WebGL, y three.js no cuenta en la carga inicial.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    const idle = (fn: () => void) => (w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 1500 }) : window.setTimeout(fn, 500))
    const events: (keyof WindowEventMap)[] = ["scroll", "touchstart", "pointerdown", "pointermove", "keydown"]
    let timer = 0
    const go = () => {
      events.forEach((e) => window.removeEventListener(e, go))
      window.clearTimeout(timer)
      idle(boot)
    }
    events.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }))
    timer = window.setTimeout(go, 3500)

    function boot() {
      if (cancelled) return
      import("./scene-network")
        .then(async ({ createNetworkScene }) => {
          if (cancelled) return
          const h = await createNetworkScene({
            canvas: cv!,
            mobile,
            still: reduced,
            onLost: () => el!.classList.remove("hn--gl"),
            cancelled: () => cancelled,
          })
          if (!h) return
          if (cancelled) {
            h.dispose()
            return
          }
          handle = h
          el!.classList.add("hn--gl")
          ro = new ResizeObserver(() => handle?.resize())
          ro.observe(st!)
          io = new IntersectionObserver(([e]) => handle?.setVisible(e.isIntersecting), { rootMargin: "80px" })
          io.observe(st!)
        })
        .catch(() => el!.classList.remove("hn--gl"))
    }

    return () => {
      cancelled = true
      events.forEach((e) => window.removeEventListener(e, go))
      window.clearTimeout(timer)
      io?.disconnect()
      ro?.disconnect()
      handle?.dispose()
    }
  }, [])

  return (
    <section ref={root} className="hn" aria-labelledby="hero-title">
      <div className="hn-bg" aria-hidden="true" />
      <div className="bd-container hn-grid">
        <div className="hn-head hn-copy">
          <p className="bd-eyebrow">Ingeniería de software · Chile</p>
          <h1 id="hero-title">
            Ideas complejas.
            <br />
            <span>Software que funciona.</span>
          </h1>
          <p className="hn-sub">Diseñamos, construimos y ponemos en producción plataformas, integraciones y sistemas a medida para empresas.</p>
        </div>

        <div ref={stage} className="hn-stage" aria-hidden="true">
          <NetworkFallback />
          <canvas ref={canvas} className="hn-canvas" />
        </div>

        <div className="hn-actions">
          <div className="hn-cta">
            <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-primary">
              Cuéntanos tu proyecto
            </Link>
            <Link href="/servicios" prefetch={false} className="bd-btn bd-btn-ghost">
              Ver servicios
            </Link>
          </div>
          <ul className="hn-chips" aria-label="Soluciones destacadas">
            <li><Link href="/servicios/soluciones-erp" prefetch={false}>Soluciones ERP</Link></li>
            <li><Link href="/servicios/soluciones-saas" prefetch={false}>Soluciones SaaS</Link></li>
            <li><Link href="/servicios/integraciones-y-apis" prefetch={false}>APIs e integraciones</Link></li>
          </ul>
          <p className="hn-proof">En producción: <b>Only Energy</b> · CFT Magallanes · GINFET</p>
        </div>

      </div>
    </section>
  )
}
