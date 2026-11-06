/**
 * Identificacion legal del proveedor. Fuente: Declaracion Jurada de Inicio de Actividades del SII (datos entregados por el titular, 2026-11-06).
 * Es el RUT de la SOCIEDAD. El RUT del solicitante del tramite (persona natural) NO se publica ni se usa aqui.
 * Sin credenciales, codigos de comercio ni datos financieros internos.
 */
export const COMPANY = {
  legalName: "Bydlight Solutions SpA",
  tradeName: "Bydlight Solutions",
  rut: "78.161.844-6",
  type: "Sociedad por Acciones (SpA)",
  activity: "Consultoría y desarrollo de software y sitios web",
  address: "S Guerra 326, Buin, Región Metropolitana, Chile",
  addressShort: "S Guerra 326, Buin",
} as const

/** Linea corta para pie de pagina y comprobantes. */
export const COMPANY_LINE = `${COMPANY.legalName} · RUT ${COMPANY.rut} · ${COMPANY.address}`
