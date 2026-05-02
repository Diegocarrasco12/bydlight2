"use client"

import { motion } from "framer-motion"
import "./Hero.css"
import Link from "next/link"

export default function Hero() {

  return (
    <section className="hero">

      <div className="hero-overlay"></div>

      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: .3 }}
        >
          Arquitectura de <span>Software</span>
          <br />
          y Desarrollo Web
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: .6 }}
        >
          Creamos plataformas y sistemas digitales para empresas.
        </motion.p>

        <motion.div
          className="hero-buttons hero-buttons-mobile"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: .9 }}
        >

          <Link href="/proyectos" prefetch={false}>            <button className="btn-primary">
            Ver Proyectos
          </button>
          </Link>

          <Link href="/contacto" prefetch={false}>            <button className="btn-secondary">
            Contáctanos
          </button>
          </Link>

        </motion.div>

      </motion.div>
      <div className="hero-mobile-orb"></div>
      <video
        className="hero-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/videos/hero2.mp4" type="video/mp4" />
      </video>

    </section>

  )
}