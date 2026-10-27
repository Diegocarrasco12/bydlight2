// Resolucion para ejecutar el codigo TypeScript del proyecto con node:test (sin dependencias nuevas):
// alias "@/", extensiones omitidas, "server-only" vacio y SDK de Transbank simulado.
import { existsSync } from "node:fs"
import { dirname, resolve as pathResolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = pathResolve(dirname(fileURLToPath(import.meta.url)), "..")
const tryExt = (base) => {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}/index.ts`]) {
    if (existsSync(c) && !c.endsWith("/") && c.match(/\.(ts|tsx|mjs)$/)) return pathToFileURL(c).href
  }
  return null
}

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: pathToFileURL(pathResolve(root, "tests/stubs/empty.mjs")).href, shortCircuit: true }
  if (specifier === "transbank-sdk") return { url: pathToFileURL(pathResolve(root, "tests/stubs/transbank-sdk.mjs")).href, shortCircuit: true }
  if (specifier.startsWith("@/")) {
    const u = tryExt(pathResolve(root, "src", specifier.slice(2)))
    if (u) return { url: u, shortCircuit: true }
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const u = tryExt(pathResolve(dirname(fileURLToPath(context.parentURL)), specifier))
    if (u) return { url: u, shortCircuit: true }
  }
  return next(specifier, context)
}
