import Link from "next/link"
import { SITE } from "@/lib/site"
import { SERVICES } from "@/lib/services"
import PaymentBrandShowcase from "@/components/payments/PaymentBrandShowcase"
import { LEGAL_DOCS, legalVisible } from "@/lib/legal"

export default function Footer() {
  return (
    <footer className="bd-footer">
      <div className="bd-container">
        <div className="bd-footer-top">
          <p className="bd-footer-claim">
            Del plano <span>al producto.</span>
          </p>
          <Link href="/contacto" prefetch={false} className="bd-btn bd-btn-primary">
            Cuéntanos tu proyecto
          </Link>
        </div>

        <div className={`bd-footer-grid${legalVisible() ? " has-legal" : ""}`}>
          <div>
            <img src={SITE.logoSmall} alt={SITE.name} width={120} height={43} />
            <p>Ingeniería de software y desarrollo web para emprendedores, pymes y empresas en Chile.</p>
          </div>

          <div>
            <h2>Servicios</h2>
            <ul>
              {SERVICES.map((s) => (
                <li key={s.slug}>
                  <Link href={`/servicios/${s.slug}`} prefetch={false}>{s.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2>Navegación</h2>
            <ul>
              <li><Link href="/" prefetch={false}>Inicio</Link></li>
              <li><Link href="/proyectos" prefetch={false}>Proyectos</Link></li>
              <li><Link href="/planes" prefetch={false}>Planes y precios</Link></li>
              <li><Link href="/nosotros" prefetch={false}>Nosotros</Link></li>
              <li><Link href="/contacto" prefetch={false}>Contacto</Link></li>
            </ul>
          </div>

          {legalVisible() && (
            <div>
              <h2>Legal</h2>
              <ul>
                {LEGAL_DOCS.map((d) => (
                  <li key={d.href}><Link href={d.href} prefetch={false}>{d.title}</Link></li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2>Contacto</h2>
            <ul>
              <li><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
              <li><a href={`https://wa.me/${SITE.whatsappNumber}`} target="_blank" rel="noopener noreferrer">WhatsApp {SITE.whatsappDisplay}</a></li>
              <li>Chile</li>
            </ul>
          </div>
        </div>

        <div className="bd-footer-bottom">
          <span>© {new Date().getFullYear()} {SITE.name}. Todos los derechos reservados.</span>
          <PaymentBrandShowcase variant="compact" place="footer" />
        </div>
      </div>
    </footer>
  )
}
