// Vista previa LOCAL de la experiencia de pago (datos de demostracion; sin cobros ni credenciales).
//   npm run preview:pagos          -> http://localhost:3100/vista-previa
// Fija BD_PREVIEW=1 y NODE_ENV=development; jamas usa credenciales ni contacta a Transbank (ver src/lib/preview.ts).
import { spawn } from "node:child_process"
import path from "node:path"

const port = process.env.PORT ?? "3100"
const env = {
  ...process.env,
  NODE_ENV: "development",
  BD_PREVIEW: "1",
  // Defensa adicional: sin credenciales ni configuracion de pagos heredadas del entorno.
  TBK_ENV: "integration",
  TBK_COMMERCE_CODE: "",
  TBK_API_KEY: "",
  ADMIN_API_SECRET: "",
  PAYMENTS_CONFIG: path.join(process.cwd(), ".data", "preview-no-config.json"),
}
const next = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next")
console.log(`\nVista previa de pagos (demostracion, sin cobros): http://localhost:${port}/vista-previa\n`)
const child = spawn(process.execPath, [next, "dev", "-p", port], { stdio: "inherit", env })
child.on("exit", (code) => process.exit(code ?? 0))
