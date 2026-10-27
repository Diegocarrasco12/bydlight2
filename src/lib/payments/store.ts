import "server-only"
import { promises as fs } from "node:fs"
import path from "node:path"
import { randomInt } from "node:crypto"
import type { Order } from "./types"

// Persistencia minima en archivos JSON (un archivo por orden).
// Sirve para desarrollo y pruebas en sandbox. En produccion el contenedor es de solo lectura y no
// tiene volumenes, asi que aqui las escrituras fallan y los pagos quedan deshabilitados (fail closed).
// La persistencia de produccion es una decision pendiente de aprobacion (ver propuesta).

const ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const ID_RE = /^[A-Z2-9]{12}$/

export function isValidOrderId(id: string): boolean {
  return ID_RE.test(id)
}

export function newOrderId(): string {
  let id = ""
  for (let i = 0; i < 12; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)]
  return id
}

function ordersDir(): string {
  return process.env.ORDERS_DIR ?? path.join(process.cwd(), ".data", "orders")
}

export async function readOrder(id: string): Promise<Order | null> {
  if (!isValidOrderId(id)) return null
  try {
    const raw = await fs.readFile(path.join(ordersDir(), `${id}.json`), "utf8")
    return JSON.parse(raw) as Order
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null
    throw e
  }
}

export async function writeOrder(order: Order): Promise<void> {
  if (!isValidOrderId(order.id)) throw new Error("id de orden invalido")
  const dir = ordersDir()
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, `${order.id}.json`)
  const tmp = `${file}.${process.pid}.tmp`
  order.updatedAt = new Date().toISOString()
  await fs.writeFile(tmp, JSON.stringify(order, null, 2), { encoding: "utf8", mode: 0o600 })
  await fs.rename(tmp, file)
}

/** Verifica que se puede escribir antes de aceptar solicitudes (fail closed). */
export async function storageWritable(): Promise<boolean> {
  try {
    const dir = ordersDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.access(dir, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

// Exclusion mutua por orden dentro del proceso (el contenedor corre una sola instancia).
const locks = new Map<string, Promise<unknown>>()

export async function withOrderLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const chain = prev.then(() => gate)
  locks.set(id, chain)
  try {
    await prev.catch(() => undefined)
    return await fn()
  } finally {
    release()
    if (locks.get(id) === chain) locks.delete(id)
  }
}
