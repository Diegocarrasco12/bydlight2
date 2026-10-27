// Inserta datos estructurados JSON-LD. Los datos son constantes del repositorio (no entrada de usuario);
// se escapa "<" para que ningun valor pueda cerrar la etiqueta <script>.
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  )
}
