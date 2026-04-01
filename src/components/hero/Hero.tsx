"use client"

import { motion } from "framer-motion"
import "./Hero.css"

export default function Hero(){

  return (
    <section className="hero">

      <div className="hero-overlay"></div>

      <motion.div
        className="hero-content"
        initial={{ opacity:0, y:40 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:1 }}
      >

        <motion.h1
          initial={{ opacity:0, y:30 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:.3 }}
        >
          Arquitectura de Software
          <br/>
          y Desarrollo Web
        </motion.h1>

        <motion.p
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          transition={{ delay:.6 }}
        >
          Creamos plataformas y sistemas digitales para empresas.
        </motion.p>

        <motion.div
          className="hero-buttons"
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          transition={{ delay:.9 }}
        >

          <button className="btn-primary">
            Ver Proyectos
          </button>

          <button className="btn-secondary">
            Contáctanos
          </button>

        </motion.div>

      </motion.div>

    </section>
  )
}