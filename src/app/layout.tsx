import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google"
import "./globals.css"
import "../styles/design.css"
import "../styles/fase2.css"
import "../styles/signature.css"
import "../styles/refine.css"
import Navbar from "../components/navbar/Navbar"
import Footer from "../components/footer/Footer"
import JsonLd from "../components/seo/JsonLd"
import { SITE, absoluteUrl } from "../lib/site"

// Tipografias de Bydlight Signature (autoalojadas por next/font; licencia SIL OFL 1.1, uso comercial permitido).
// Titulos: Space Grotesk (pesos 400-600). Texto: Inter (variable). Rotulos y cifras: IBM Plex Mono (solo detalles tecnicos).
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Desarrollo web y software a medida en Chile | Byd Light",
    template: "%s | Byd Light Solutions",
  },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: SITE.name,
    url: SITE.url,
    title: "Desarrollo web y software a medida en Chile | Byd Light",
    description: SITE.description,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Byd Light Solutions: desarrollo web y software a medida en Chile" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  icons: { icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-192.png" },
}

export const viewport: Viewport = {
  themeColor: "#04060c",
}

const organization = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: SITE.name,
      legalName: `${SITE.name} SpA`,
      alternateName: SITE.shortName,
      url: SITE.url,
      logo: absoluteUrl(SITE.logo),
      email: SITE.email,
      areaServed: { "@type": "Country", name: "Chile" },
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "sales",
          email: SITE.email,
          telephone: "+56983249135",
          availableLanguage: ["es"],
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      url: SITE.url,
      name: SITE.name,
      inLanguage: "es-CL",
      publisher: { "@id": absoluteUrl("/#organization") },
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Las variables de fuente van en <html>: los tokens (--display, --body, --mono) se definen en :root y deben poder resolverlas.
  return (
    <html lang="es-CL" className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>
        <a href="#contenido" className="bd-skip">Saltar al contenido</a>
        <JsonLd data={organization} />
        <Navbar />
        <main id="contenido" className="bd-main">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
