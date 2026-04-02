import Hero from "../components/hero/Hero"
import Services from "../components/services/Services"
import Process from "@/components/process/Process"
import Projects from "@/components/projects/Projects"
import CTA from "@/components/cta/CTA"
import Contact from "@/components/contact/Contact"
import Trust from "@/components/trust/Trust"

export default function Home(){
  return (
    <>
      <Hero/>
      <Services/>
      <Process />
      <Projects />
      <CTA />
      <Contact />
      <Trust />
    </>
  )

}