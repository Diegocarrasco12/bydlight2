// Doble de prueba del SDK de Transbank: nunca sale a la red. Cada prueba fija globalThis.__tbk.
export const Environment = { Integration: "integration", Production: "production" }
export const IntegrationCommerceCodes = { WEBPAY_PLUS: "597055555532" }
export const IntegrationApiKeys = { WEBPAY: "test-key" }
export class Options {
  constructor(commerceCode, apiKey, environment) {
    this.commerceCode = commerceCode
    this.apiKey = apiKey
    this.environment = environment
  }
}
export const WebpayPlus = {
  Transaction: class {
    constructor(options) {
      globalThis.__tbkOptions = options
    }
    create(...a) { return globalThis.__tbk.create(...a) }
    commit(...a) { return globalThis.__tbk.commit(...a) }
    status(...a) { return globalThis.__tbk.status(...a) }
  },
}
