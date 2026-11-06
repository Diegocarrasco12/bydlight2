// PNG (assets-fuente/renders3d) -> AVIF y WebP en public/img/servicios3d/ (dos anchos). Fuentes: scripts/renders3d/.
import sharp from "sharp"
import { mkdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
const src = new URL("../../assets-fuente/renders3d/", import.meta.url)
const out = new URL("../../public/img/servicios3d/", import.meta.url)
mkdirSync(out, { recursive: true })
const names = { s1: "software", s2: "web", s3: "moviles", s4: "integraciones", s5: "automatizacion", s6: "arquitectura" }
const rows = []
for (const [id, name] of Object.entries(names)) {
  const input = fileURLToPath(new URL(`${id}.png`, src))
  const meta = await sharp(input).metadata()
  for (const w of [Math.round(meta.width * 0.56), meta.width]) {
    const img = () => sharp(input).resize({ width: w })
    for (const [fmt, opts] of [["avif", { quality: 62, effort: 6 }], ["webp", { quality: 86, effort: 6 }]]) {
      const f = fileURLToPath(new URL(`${name}-${w}.${fmt}`, out))
      await img()[fmt](opts).toFile(f)
      rows.push(`${name}-${w}.${fmt}\t${meta.width}x${meta.height}\t${(statSync(f).size / 1024).toFixed(1)} KB`)
    }
  }
}
console.log(rows.join("\n"))
