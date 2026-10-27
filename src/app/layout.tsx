import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import "../styles/design.css"
import Navbar from "../components/navbar/Navbar"
import Footer from "../components/footer/Footer"
import JsonLd from "../components/seo/JsonLd"
import { SITE, absoluteUrl } from "../lib/site"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Desarrollo web y software a medida en Chile | Byd Light Solutions",
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
    title: "Desarrollo web y software a medida en Chile | Byd Light Solutions",
    description: SITE.description,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Byd Light Solutions: desarrollo web y software a medida en Chile" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-192.png" },
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
  return (
    <html lang="es-CL">
      <body className={`${display.variable} ${geistSans.variable} ${geistMono.variable}`}>
        <a href="#contenido" className="bd-skip">Saltar al contenido</a>
        <JsonLd data={organization} />
        <Navbar />
        <main id="contenido" className="bd-main">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
