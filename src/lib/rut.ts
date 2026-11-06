// RUT chileno: validacion con modulo 11 y formato. Sin dependencias (se usa en servidor y navegador).

export function cleanRut(v: string): string {
  return v.replace(/[^0-9kK]/g, "").toUpperCase()
}

export function rutDv(body: string): string {
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const r = 11 - (sum % 11)
  return r === 11 ? "0" : r === 10 ? "K" : String(r)
}

/** Devuelve el RUT con formato 12.345.678-9 o null si no es valido. Acepta con o sin puntos y guion. */
export function normalizeRut(v: string): string | null {
  const c = cleanRut(v)
  if (c.length < 2 || c.length > 9) return null
  const body = c.slice(0, -1)
  const dv = c.slice(-1)
  if (!/^\d+$/.test(body) || Number(body) < 1_000_000) return null
  if (rutDv(body) !== dv) return null
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`
}
