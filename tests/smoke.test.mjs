import test from "node:test"
import assert from "node:assert/strict"
test("carga modulos TS", async () => {
  const m = await import("../src/lib/payments/store.ts")
  assert.equal(m.isValidOrderId("ABCDEFGHJKMN"), true)
})
