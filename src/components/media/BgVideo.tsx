"use client"

import { useEffect, useRef, useState } from "react"

// Video decorativo: muestra el poster (WebP) y solo carga el MP4 cuando entra en pantalla,
// siempre que el usuario no pida menos movimiento ni tenga ahorro de datos.
export default function BgVideo({
  src,
  poster,
  className,
}: {
  src: string
  poster: string
  className?: string
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [play, setPlay] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (reduce || saver) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlay(true)
          io.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <video
      ref={ref}
      className={className}
      src={play ? src : undefined}
      poster={poster}
      autoPlay={play}
      loop
      muted
      playsInline
      preload="none"
      aria-hidden="true"
    />
  )
}
