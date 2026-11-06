import type { Metadata } from "next"
import LegalPage from "@/components/legal/LegalPage"
import { requireLegalVisible } from "@/lib/legal"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Política de cancelación, retracto y devoluciones",
  robots: { index: false, follow: false },
}

/**
 * Basada en el articulo 3 bis y 12 A de la Ley 19.496 (BCN, consultada 2026-11-06). No presenta una interpretacion discutible como certeza:
 * no excluye el retracto en forma general, no declara irreembolsables los anticipos y no fija porcentajes que el titular no haya aprobado.
 * Pendiente de revision por asesor legal.
 */
export default function DevolucionesPage() {
  requireLegalVisible()
  return (
    <LegalPage path="/devoluciones" title="Política de cancelación, retracto y devoluciones" lead="Qué ocurre si quieres cancelar o si un pago debe devolverse.">
      <h2>1. Derecho de retracto (consumidores)</h2>
      <p>
        Si contratas como consumidor por medios electrónicos, la Ley N° 19.496 (artículo 3 bis) te permite poner término unilateral al contrato dentro de
        10 días contados desde la contratación del servicio y antes de que el servicio se preste. Si Bydlight no te envía la confirmación escrita del contrato
        (artículo 12 A), ese plazo se extiende a 90 días. Bydlight no excluye en forma general este derecho en servicios de desarrollo; cada caso se evalúa
        conforme a la ley.
      </p>
      <p>
        Para ejercerlo, escribe a <a href={`mailto:${SITE.email}`}>{SITE.email}</a> indicando el código de tu orden y que deseas retractarte. En servicios, la devolución comprende
        las sumas abonadas que no correspondan a servicios ya prestados al momento del retracto, sin retención de gastos, a la mayor brevedad y, en todo caso, antes de
        45 días desde que comunicas el retracto.
      </p>
      <h2>2. Cancelación fuera del plazo de retracto, y contratos entre empresas</h2>
      <p>
        Bydlight no considera irreembolsables todos los anticipos. Si deseas cancelar un proyecto, se evalúa el trabajo efectivamente ejecutado a la fecha y se
        determina lo que corresponda devolver legal o contractualmente. Las condiciones específicas de cancelación de cada proyecto, incluidas las de contratos entre
        empresas, constan en su cotización o contrato.
      </p>
      <h2>3. Cómo solicitarlo</h2>
      <ol>
        <li>Escribe a <a href={`mailto:${SITE.email}`}>{SITE.email}</a> (o por WhatsApp {SITE.whatsappDisplay}) con el código de tu orden y tu solicitud.</li>
        <li>Bydlight deja constancia por escrito de tu solicitud y la fecha en que la recibió.</li>
        <li>Se revisa el trabajo ejecutado y se te informa por escrito el monto a devolver, si corresponde.</li>
      </ol>
      <h2>4. Cómo se devuelve el dinero</h2>
      <p>
        Los pagos con tarjeta se procesan mediante Webpay Plus de Transbank. Cuando corresponde devolver un pago, se gestiona con Transbank por el mismo medio de pago
        original. El momento en que el monto se refleja en tu cuenta o tarjeta depende de Transbank y de tu banco emisor. Bydlight no realiza devoluciones automáticas.
      </p>
      <h2>5. Pagos duplicados o erróneos</h2>
      <p>
        Si ves un cobro duplicado o erróneo, escríbenos con el código de tu orden. Revisamos el estado de la transacción con Transbank y, de corresponder, gestionamos
        la anulación o devolución.
      </p>
    </LegalPage>
  )
}
