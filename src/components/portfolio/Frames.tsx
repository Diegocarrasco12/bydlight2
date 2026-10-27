import type { ProjectImage } from "@/lib/portfolio"

// Marcos de dispositivo hechos con CSS (sin imagenes protegidas): ventana de navegador y ventana de aplicacion.

export function BrowserFrame({
  image,
  url,
  priority = false,
  className = "",
}: {
  image: ProjectImage
  url: string
  priority?: boolean
  className?: string
}) {
  return (
    <figure className={`dev dev-browser ${className}`}>
      <div className="dev-bar" aria-hidden="true">
        <i /><i /><i />
        <span>{url}</span>
      </div>
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
    </figure>
  )
}

export function AppFrame({ image, title, className = "" }: { image: ProjectImage; title: string; className?: string }) {
  return (
    <figure className={`dev dev-app ${className}`}>
      <div className="dev-bar" aria-hidden="true">
        <span className="ttl">{title}</span>
        <b /><b /><b />
      </div>
      <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
    </figure>
  )
}
