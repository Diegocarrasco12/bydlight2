// Doble de next/navigation para pruebas en Node: notFound/redirect lanzan, como en Next.
export function notFound() { throw new Error("NEXT_NOT_FOUND") }
export function redirect(to) { throw new Error(`NEXT_REDIRECT:${to}`) }
