import "server-only"
import { checkoutMode } from "./config"
import { PILOT_COOKIE, cookieValue, pilotCookieValid } from "./pilot"

/** true si esta peticion puede usar el checkout: modo public, o modo pilot con cookie firmada valida. closed = nunca. */
export function checkoutOpenFor(cookieHeader: string | null | undefined): boolean {
  const mode = checkoutMode()
  if (mode === "public") return true
  if (mode === "pilot") return pilotCookieValid(cookieValue(cookieHeader, PILOT_COOKIE))
  return false
}
