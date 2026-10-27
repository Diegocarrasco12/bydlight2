"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { whatsappLink } from "@/lib/site"
import { BrowserFrame } from "@/components/portfolio/Frames"
import { FEATURED } from "@/lib/portfolio"

// Hero cinematografico. Tres niveles, del mas rico al mas liviano:
//  1. Escena 3D (three.js) guiada por el scroll: el nucleo de luz ensambla la interfaz de un producto real.
//  2. Sin WebGL, con ahorro de datos o equipo modesto: composicion estatica con CSS (nucleo de luz + plano).
//  3. prefers-reduced-motion o sin JavaScript: la misma composicion estatica, sin animacion ni scroll pegajoso.
// Los modos se aplican con classList (hx--static, hx--gl) para no re-renderizar el hero.
// La escena nunca bloquea el contenido: el titular y los botones son HTML desde el primer byte.

type Conn = { saveData?: boolean }
type Nav = Navigator & { connection?: Conn; deviceMemory?: number }

function canRun3D(): boolean {
  if (typeof window === "undefined") return false
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false
  const nav = navigator as Nav
  if (nav.connection?.saveData) return false
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4) return false
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false
  // Sin sondear WebGL aqui (crear contextos de prueba es caro): si el renderer no se puede crear, createScene lanza
  // y el hero cae a la version estatica.
  return typeof WebGLRenderingContext !== "undefined"
}

export default function HeroStage() {
  const root = useRef<HTMLElement | null>(null)
  const stick = useRef<HTMLDivElement | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const mock = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = root.current
    const st = stick.current
    if (!el || !st) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("hx--static")
      return
    }

    let cancelled = false
    let handle: import("./scene").SceneHandle | null = null
    let raf = 0
    let p = 0
    const live = canRun3D()
    if (!live) el.classList.add("hx--static")

    const readProgress = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const total = Math.max(1, r.height - window.innerHeight)
      p = Math.min(1, Math.max(0, -r.top / total))
      el.style.setProperty("--p", p.toFixed(4))
      el.dataset.stage = p < 0.26 ? "1" : p < 0.66 ? "2" : "3"
      handle?.setProgress(p)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(readProgress)
    }
    if (live) {
      window.addEventListener("scroll", onScroll, { passive: true })
      readProgress()
    }

    const mobile = window.matchMedia("(max-width: 760px)").matches
    const onResize = () => {
      handle?.resize()
      readProgress()
    }

    // La escena se inicia con el navegador ocioso, despues del primer pintado: el titular nunca espera a three.js.
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const idle = (fn: () => void) => (ric ? ric(fn, { timeout: 1200 }) : setTimeout(fn, 400))
    if (live && canvas.current) idle(() => {
      if (cancelled || !canvas.current) return
      import("./scene")
        .then(({ createScene }) => {
          if (cancelled || !canvas.current) return
          handle = createScene({
            canvas: canvas.current,
            mobile,
            getDock: () => {
              const m = mock.current
              if (!m) return null
              return { x: m.offsetLeft, y: m.offsetTop, w: m.offsetWidth, h: m.offsetHeight }
            },
          })
          handle.setProgress(p)
          el.classList.add("hx--gl")
          window.addEventListener("resize", onResize)
        })
        .catch(() => el.classList.add("hx--static"))
    })

    const io = new IntersectionObserver(([e]) => handle?.setVisible(e.isIntersecting), { rootMargin: "100px" })
    io.observe(el)

    return () => {
      cancelled = true
      io.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      if (raf) cancelAnimationFrame(raf)
      handle?.dispose()
    }
  }, [])

  return (
    <section
      ref={root}
      className="hx"
      data-stage="1"
      aria-labelledby="hero-title"
    >
      <noscript>
        <style>{`.hx{height:auto!important}.hx-stick{position:relative!important;height:auto!important;min-height:100svh}.hx-mock{opacity:1!important;transform:none!important}.hx-copy{opacity:1!important}`}</style>
      </noscript>
      <div ref={stick} className="hx-stick">
        <div className="hx-backdrop" aria-hidden="true">
          <div className="hx-blueprint" />
          <div className="hx-glow" />
        </div>
        <canvas ref={canvas} className="hx-canvas" aria-hidden="true" />

        <div className="hx-copy">
          <p className="bd-eyebrow">Ingeniería de software · Chile</p>
          <h1 id="hero-title">
            Ideas complejas.
            <br />
            <span>Software que funciona.</span>
          </h1>
          <p className="hx-sub">Diseñamos, construimos y ponemos en producción sitios, plataformas y sistemas a medida.</p>
          <div className="hx-cta">
            <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-primary">
              Cuéntanos tu proyecto
            </Link>
            <Link href="/proyectos" prefetch={false} className="bd-btn bd-btn-ghost">
              Ver proyectos
            </Link>
          </div>
        </div>

        <div ref={mock} className="hx-mock">
          <BrowserFrame image={FEATURED.images[0]} url="onlyenergyspa.cl" priority />
        </div>

        <div className="hx-final">
          <p>
            <strong>{FEATURED.name}</strong> · tienda online en producción
          </p>
          <div className="hx-final-cta">
            <Link href="/proyectos/only-energy" prefetch={false} className="bd-btn bd-btn-ghost">
              Ver el proyecto
            </Link>
            <a href={whatsappLink("Hola, quiero cotizar un proyecto con Byd Light Solutions.")} target="_blank" rel="noopener noreferrer" className="bd-btn bd-btn-primary">
              Cotizar por WhatsApp
            </a>
          </div>
        </div>

        <ol className="hx-steps" aria-label="De la idea al producto">
          <li data-n="1"><span>01</span> Idea</li>
          <li data-n="2"><span>02</span> Plano</li>
          <li data-n="3"><span>03</span> Producto</li>
        </ol>
        <div className="hx-cue" aria-hidden="true"><i /></div>
      </div>
    </section>
  )
}
