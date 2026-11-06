#!/usr/bin/env node
// Prueba REAL del SDK oficial contra el ambiente de INTEGRACION de Transbank (credenciales publicas de pruebas del SDK).
// Crea una transaccion y consulta su estado. No mueve dinero y no usa credenciales productivas. Requiere red.
//   node scripts/sdk-integration-check.mjs
import { Environment, IntegrationApiKeys, IntegrationCommerceCodes, Options, WebpayPlus } from "transbank-sdk"

const tx = new WebpayPlus.Transaction(new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration, 15000))
const buyOrder = `BLCHECK${Date.now().toString(36).toUpperCase()}`.slice(0, 26)
const res = await tx.create(buyOrder, "CHECKSESSION", 100, "https://bydlightsolutions.com/api/pagos/retorno/ABCDEFGHJKMN")
const ok1 = typeof res.token === "string" && res.token.length >= 32 && /^https:\/\/webpay3gint\.transbank\.cl\//.test(res.url)
console.log(`create: ${ok1 ? "OK" : "FALLA"} (token de ${res.token?.length} caracteres, url ${new URL(res.url).host})`)
const st = await tx.status(res.token)
const ok2 = st.status === "INITIALIZED" && st.buy_order === buyOrder && Number(st.amount) === 100 && st.session_id === "CHECKSESSION"
console.log(`status: ${ok2 ? "OK" : "FALLA"} (estado ${st.status}, orden coincide: ${st.buy_order === buyOrder}, monto ${st.amount})`)
let rejected = false
try { await tx.commit(res.token) } catch { rejected = true }
console.log(`commit sin pago del cliente: ${rejected ? "rechazado por Transbank, como corresponde" : "FALLA (no debia confirmarse)"}`)
process.exit(ok1 && ok2 && rejected ? 0 : 1)
