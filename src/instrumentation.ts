// Se ejecuta una vez al iniciar el servidor (no en el build). Arranca el despachador de correos solo si el correo esta
// habilitado y configurado; en caso contrario no hace nada (no abre la base de datos ni crea archivos).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const [{ activeTransport }, { startMailTimer }] = await Promise.all([import("@/lib/mail/transport"), import("@/lib/mail/outbox")])
  if (activeTransport()) startMailTimer()
}
