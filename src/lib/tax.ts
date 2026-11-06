// IVA de Chile. Decision del titular (2026-11-06): TODOS los precios publicados y cotizados son FINALES e INCLUYEN IVA.
// El IVA nunca se suma sobre un precio ya publicado ni sobre un monto cotizado: solo se DESGLOSA desde el total.
//
// Convencion de redondeo (unica, en CLP enteros): neto = round(total / 1,19); IVA = total - neto. Asi neto + IVA == total
// siempre, sin diferencias de un peso. Aplica a la tasa general vigente (19 %). Este desglose es informativo: no es un
// documento tributario ni reemplaza la boleta o factura (ver docs/SII-PROCEDIMIENTO-PROPUESTO.md).

export const IVA_PERCENT = 19

export type IvaBreakdown = { total: number; net: number; iva: number; percent: number }

export function ivaBreakdown(total: number, percent = IVA_PERCENT): IvaBreakdown {
  if (!Number.isInteger(total) || total < 0) throw new Error("El total debe ser un entero en CLP")
  const net = Math.round((total * 100) / (100 + percent))
  return { total, net, iva: total - net, percent }
}

/** Anticipo sobre el TOTAL final (con IVA). Redondeo al peso mas cercano (mitades hacia arriba); el saldo es la diferencia exacta. */
export function splitDeposit(total: number, depositPercent: number): { deposit: number; balance: number } {
  const deposit = Math.round((total * depositPercent) / 100)
  return { deposit, balance: total - deposit }
}
