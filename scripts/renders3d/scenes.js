/* eslint-disable */
// Renders 3D originales de «Lo que construimos» (Bydlight Signature · Cinematic 3D Technology).
// Procedimiento: three.js (MIT) en un navegador sin cabeza -> PNG -> AVIF/WebP (scripts/renders3d/optimize.mjs).
// Todo es geometria y texturas propias: no hay fotografias, marcas de terceros ni datos reales. Las cifras de las
// interfaces son ilustrativas. Uso: render.html?scene=s1..s6 (ver SCENES para el tamano de cada imagen).
import * as THREE from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"

const SCENES = {
  s1: { w: 1200, h: 1100, build: sceneSoftware },
  s2: { w: 1000, h: 520, build: sceneWeb },
  s3: { w: 1000, h: 520, build: sceneMobile },
  s4: { w: 1000, h: 560, build: sceneIntegration },
  s5: { w: 800, h: 600, build: sceneAutomation },
  s6: { w: 800, h: 600, build: sceneArchitecture },
}

const ORANGE = 0xff8a3d
const BLUE = 0x5b8cff
const FONT = "Inter, 'Segoe UI', Arial, sans-serif"
const MONO = "'Cascadia Mono', Consolas, 'Courier New', monospace"

/* ---------------------------------------------------------------- utilidades 2D */
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")] }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r) }
function fillRR(g, x, y, w, h, r, fill, stroke, lw = 2) { rr(g, x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill() } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke() } }
function txt(g, s, x, y, size, color, weight = 400, align = "left", font = FONT) { g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic"; g.fillText(s, x, y) }
function lin(g, x0, y0, x1, y1, stops) { const l = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => l.addColorStop(o, c)); return l }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t }

/* ---------------------------------------------------------------- texturas de interfaz */
function dashboardTex() {
  const [c, g] = canvas(2048, 1280)
  g.fillStyle = "#0b0d13"; g.fillRect(0, 0, 2048, 1280)
  // barra lateral
  g.fillStyle = "#0e1118"; g.fillRect(0, 0, 300, 1280); g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(300, 0, 2, 1280)
  fillRR(g, 44, 44, 54, 54, 14, lin(g, 44, 44, 98, 98, [[0, "#ffab70"], [1, "#ff6a1a"]]))
  txt(g, "Bydlight", 114, 84, 34, "#f2f4f8", 600)
  const menu = ["Panel", "Inventario", "Ventas", "Pedidos", "Reportes", "Integraciones", "Usuarios"]
  menu.forEach((m, i) => {
    const y = 170 + i * 84
    if (i === 0) fillRR(g, 24, y - 38, 252, 64, 16, "rgba(255,138,61,.14)", "rgba(255,138,61,.35)", 1.5)
    fillRR(g, 48, y - 14, 24, 24, 7, i === 0 ? "#ff8a3d" : "rgba(255,255,255,.22)")
    txt(g, m, 92, y + 6, 28, i === 0 ? "#fff" : "#8e96a6", i === 0 ? 600 : 400)
  })
  // barra superior
  fillRR(g, 350, 40, 720, 64, 18, "rgba(255,255,255,.05)", "rgba(255,255,255,.08)", 1.5)
  txt(g, "Buscar pedido, producto o cliente…", 392, 82, 26, "#6c7384")
  fillRR(g, 1730, 40, 64, 64, 32, lin(g, 0, 0, 64, 64, [[0, "#5b8cff"], [1, "#3a56c8"]]))
  fillRR(g, 1640, 52, 64, 40, 20, "rgba(255,255,255,.07)")
  txt(g, "Resumen operativo", 350, 190, 54, "#f2f4f8", 600)
  txt(g, "Datos de ejemplo", 350, 232, 26, "#6c7384")
  // KPIs
  const k = [["Ventas del mes", "$ 48,2 M", "+12,4 %", "#4ade9d"], ["Pedidos", "1.284", "+8,1 %", "#4ade9d"], ["Stock crítico", "23", "−5 ítems", "#ff8a3d"], ["Entregas a tiempo", "96 %", "+1,2 %", "#4ade9d"]]
  k.forEach(([a, b, d, col], i) => {
    const x = 350 + i * 420, y = 280
    fillRR(g, x, y, 392, 200, 24, lin(g, x, y, x, y + 200, [[0, "rgba(255,255,255,.07)"], [1, "rgba(255,255,255,.025)"]]), "rgba(255,255,255,.09)", 1.5)
    txt(g, a, x + 30, y + 54, 26, "#8e96a6"); txt(g, b, x + 30, y + 124, 62, "#fff", 600); txt(g, d, x + 30, y + 170, 26, col, 500)
    g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); for (let j = 0; j < 9; j++) { const px = x + 230 + j * 17, py = y + 150 - Math.sin(j * 0.9 + i) * 14 - j * 3; j ? g.lineTo(px, py) : g.moveTo(px, py) } g.stroke()
  })
  // gráfico de área
  const cx = 350, cy = 530, cw = 1060, ch = 420
  fillRR(g, cx, cy, cw, ch, 26, "rgba(255,255,255,.04)", "rgba(255,255,255,.09)", 1.5)
  txt(g, "Ventas por semana", cx + 36, cy + 62, 32, "#e8ebf2", 600)
  for (let i = 0; i < 5; i++) { g.strokeStyle = "rgba(255,255,255,.06)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx + 36, cy + 120 + i * 62); g.lineTo(cx + cw - 36, cy + 120 + i * 62); g.stroke() }
  const pts = [0.45, 0.52, 0.4, 0.62, 0.55, 0.74, 0.66, 0.82, 0.7, 0.9, 0.84, 0.96]
  const px = (i) => cx + 56 + (i / (pts.length - 1)) * (cw - 112), py = (v) => cy + ch - 56 - v * 250
  g.beginPath(); pts.forEach((v, i) => i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v))); g.lineTo(px(pts.length - 1), cy + ch - 56); g.lineTo(px(0), cy + ch - 56); g.closePath()
  g.fillStyle = lin(g, 0, cy + 100, 0, cy + ch, [[0, "rgba(255,138,61,.45)"], [1, "rgba(255,138,61,0)"]]); g.fill()
  g.beginPath(); pts.forEach((v, i) => i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v))); g.strokeStyle = "#ff9a55"; g.lineWidth = 6; g.lineJoin = "round"; g.stroke()
  g.beginPath(); pts.forEach((v, i) => i ? g.lineTo(px(i), py(v + (i % 2 ? -0.08 : 0.04) - 0.12)) : g.moveTo(px(i), py(v - 0.12))); g.strokeStyle = "#5b8cff"; g.lineWidth = 4; g.stroke()
  pts.forEach((v, i) => { if (i === 9) { g.fillStyle = "#fff"; g.beginPath(); g.arc(px(i), py(v), 11, 0, 7); g.fill(); g.strokeStyle = "#ff8a3d"; g.lineWidth = 5; g.stroke() } })
  // donut
  const dx = 1450, dy = 530
  fillRR(g, dx, dy, 548, 420, 26, "rgba(255,255,255,.04)", "rgba(255,255,255,.09)", 1.5)
  txt(g, "Canales", dx + 36, dy + 62, 32, "#e8ebf2", 600)
  const segs = [["#ff8a3d", 0.42], ["#5b8cff", 0.31], ["#4ade9d", 0.17], ["#8e96a6", 0.1]]
  let a0 = -Math.PI / 2; segs.forEach(([col, f]) => { g.beginPath(); g.arc(dx + 170, dy + 240, 100, a0, a0 + f * Math.PI * 2 - 0.05); g.strokeStyle = col; g.lineWidth = 36; g.lineCap = "butt"; g.stroke(); a0 += f * Math.PI * 2 })
  txt(g, "100 %", dx + 170, dy + 252, 40, "#fff", 600, "center")
  ;["Tienda", "Sucursales", "Mayoristas", "Otros"].forEach((n, i) => { fillRR(g, dx + 330, dy + 150 + i * 56, 20, 20, 6, segs[i][0]); txt(g, n, dx + 362, dy + 168 + i * 56, 26, "#aab1c0") })
  // tabla
  const ty = 990
  fillRR(g, 350, ty, 1648, 250, 26, "rgba(255,255,255,.04)", "rgba(255,255,255,.09)", 1.5)
  txt(g, "Últimos pedidos", 386, ty + 56, 32, "#e8ebf2", 600)
  ;[["#10482", "Despacho a sucursal", "Preparando", "#ff8a3d"], ["#10481", "Retiro en tienda", "Entregado", "#4ade9d"], ["#10480", "Despacho a domicilio", "En ruta", "#5b8cff"]].forEach((r, i) => {
    const y = ty + 110 + i * 46
    txt(g, r[0], 386, y, 26, "#8e96a6", 500, "left", MONO); txt(g, r[1], 560, y, 26, "#d5dae5"); fillRR(g, 1500, y - 28, 170, 40, 20, "rgba(255,255,255,.06)"); fillRR(g, 1520, y - 14, 12, 12, 6, r[3]); txt(g, r[2], 1546, y + 2, 22, "#d5dae5")
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(1760, y - 12, 190, 6)
  })
  return tex(c)
}

function codeTex() {
  const [c, g] = canvas(1600, 1000)
  g.fillStyle = "#0a0c11"; g.fillRect(0, 0, 1600, 1000)
  g.fillStyle = "#0e1118"; g.fillRect(0, 0, 1600, 76)
  ;["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(44 + i * 36, 38, 11, 0, 7); g.fill() })
  fillRR(g, 200, 14, 280, 52, 14, "rgba(255,255,255,.07)"); txt(g, "pedidos.service.ts", 226, 48, 24, "#e8ebf2", 500, "left", MONO)
  txt(g, "api.routes.ts", 520, 48, 24, "#6c7384", 400, "left", MONO)
  g.fillStyle = "#0d1016"; g.fillRect(0, 76, 80, 924)
  const L = [
    [["export ", "#ff8a3d"], ["class ", "#ff8a3d"], ["PedidosService ", "#7ee0ff"], ["{", "#aab1c0"]],
    [["  constructor", "#c9a6ff"], ["(private ", "#ff8a3d"], ["erp", "#e8ebf2"], [": ", "#aab1c0"], ["ErpClient", "#7ee0ff"], [") {}", "#aab1c0"]],
    [],
    [["  async ", "#ff8a3d"], ["crear", "#ffd479"], ["(datos: ", "#e8ebf2"], ["NuevoPedido", "#7ee0ff"], [") {", "#aab1c0"]],
    [["    const ", "#ff8a3d"], ["pedido ", "#e8ebf2"], ["= ", "#aab1c0"], ["await ", "#ff8a3d"], ["this", "#c9a6ff"], [".erp.", "#e8ebf2"], ["registrar", "#ffd479"], ["(datos)", "#e8ebf2"]],
    [["    await ", "#ff8a3d"], ["this", "#c9a6ff"], [".inventario.", "#e8ebf2"], ["reservar", "#ffd479"], ["(pedido.lineas)", "#e8ebf2"]],
    [["    if ", "#ff8a3d"], ["(!pedido.", "#e8ebf2"], ["pagado", "#e8ebf2"], [") ", "#aab1c0"], ["return ", "#ff8a3d"], ["pedido", "#e8ebf2"]],
    [["    return ", "#ff8a3d"], ["this", "#c9a6ff"], [".despacho.", "#e8ebf2"], ["programar", "#ffd479"], ["(pedido)", "#e8ebf2"]],
    [["  }", "#aab1c0"]],
    [],
    [["  // reintentos con espera progresiva e idempotencia", "#566074"]],
    [["  async ", "#ff8a3d"], ["sincronizar", "#ffd479"], ["() {", "#aab1c0"]],
    [["    for await ", "#ff8a3d"], ["(const ", "#ff8a3d"], ["lote ", "#e8ebf2"], ["of ", "#ff8a3d"], ["this", "#c9a6ff"], [".erp.", "#e8ebf2"], ["paginas", "#ffd479"], ["()) {", "#aab1c0"]],
    [["      await ", "#ff8a3d"], ["this", "#c9a6ff"], [".cola.", "#e8ebf2"], ["publicar", "#ffd479"], ["(lote)", "#e8ebf2"]],
    [["    }", "#aab1c0"]],
    [["  }", "#aab1c0"]],
    [["}", "#aab1c0"]],
  ]
  L.forEach((ln, i) => {
    const y = 138 + i * 50
    txt(g, String(i + 1), 56, y, 24, "#3d4556", 400, "right", MONO)
    let x = 110; ln.forEach(([s, col]) => { g.font = `400 26px ${MONO}`; txt(g, s, x, y, 26, col, 400, "left", MONO); x += g.measureText(s).width })
    if (i === 5) { g.fillStyle = "rgba(255,138,61,.07)"; g.fillRect(80, y - 34, 1520, 48) }
  })
  g.fillStyle = "#ff8a3d"; g.fillRect(110 + 26 * 15.6, 138 + 5 * 50 - 30, 3, 38)
  return tex(c)
}

function siteTex() {
  const W = 1800, H = 1200
  const [c, g] = canvas(W, H)
  // marco de navegador
  g.fillStyle = "#0c0e14"; g.fillRect(0, 0, W, H)
  g.fillStyle = "#12151d"; g.fillRect(0, 0, W, 92)
  ;["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(52 + i * 40, 46, 12, 0, 7); g.fill() })
  fillRR(g, 300, 20, 1200, 52, 26, "rgba(255,255,255,.07)")
  g.strokeStyle = "#8e96a6"; g.lineWidth = 3; g.beginPath(); g.roundRect(336, 38, 18, 14, 3); g.stroke(); g.beginPath(); g.arc(345, 38, 6, Math.PI, 0); g.stroke()
  txt(g, "tuempresa.cl", 372, 56, 26, "#c3c9d6", 400)
  // sitio
  g.save(); g.translate(0, 92)
  const sh = H - 92
  g.fillStyle = lin(g, 0, 0, W, sh, [[0, "#0d0f16"], [1, "#0a0b10"]]); g.fillRect(0, 0, W, sh)
  const glow = g.createRadialGradient(1380, 300, 10, 1380, 300, 760); glow.addColorStop(0, "rgba(255,138,61,.42)"); glow.addColorStop(1, "rgba(255,138,61,0)"); g.fillStyle = glow; g.fillRect(0, 0, W, sh)
  const glow2 = g.createRadialGradient(300, 700, 10, 300, 700, 600); glow2.addColorStop(0, "rgba(91,140,255,.22)"); glow2.addColorStop(1, "rgba(91,140,255,0)"); g.fillStyle = glow2; g.fillRect(0, 0, W, sh)
  fillRR(g, 90, 46, 44, 44, 12, lin(g, 90, 46, 134, 90, [[0, "#ffab70"], [1, "#ff6a1a"]])); txt(g, "Tu Empresa", 150, 78, 30, "#f2f4f8", 600)
  ;["Servicios", "Proyectos", "Planes", "Contacto"].forEach((n, i) => txt(g, n, 900 + i * 150, 78, 25, "#aab1c0"))
  fillRR(g, 1520, 40, 190, 58, 29, "#ff8a3d"); txt(g, "Cotizar", 1615, 77, 25, "#1a0d02", 600, "center")
  txt(g, "SITIO PROFESIONAL", 96, 270, 22, "#ff9a55", 600, "left", MONO)
  txt(g, "Tu negocio,", 90, 380, 100, "#ffffff", 600); txt(g, "visible y vendiendo.", 90, 495, 100, "#ffb27d", 600)
  txt(g, "Sitios rápidos, claros y listos para ser", 94, 580, 34, "#9aa2b2"); txt(g, "encontrados en Google.", 94, 626, 34, "#9aa2b2")
  fillRR(g, 94, 680, 260, 76, 38, "#ff8a3d"); txt(g, "Ver planes", 224, 729, 30, "#1a0d02", 600, "center")
  fillRR(g, 380, 680, 260, 76, 38, null, "rgba(255,255,255,.28)", 2); txt(g, "Hablemos", 510, 729, 30, "#f2f4f8", 500, "center")
  // maqueta de producto a la derecha
  fillRR(g, 1010, 200, 640, 460, 34, lin(g, 1010, 200, 1650, 660, [[0, "rgba(255,255,255,.14)"], [1, "rgba(255,255,255,.04)"]]), "rgba(255,255,255,.18)", 2)
  fillRR(g, 1050, 240, 560, 190, 22, lin(g, 1050, 240, 1610, 430, [[0, "#ff9a55"], [1, "#5b3bd6"]]))
  fillRR(g, 1050, 456, 270, 170, 20, "rgba(255,255,255,.1)"); fillRR(g, 1340, 456, 270, 170, 20, "rgba(255,255,255,.07)")
  g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(1074, 486, 130, 12); g.fillRect(1074, 516, 200, 9); g.fillRect(1364, 486, 100, 12); g.fillRect(1364, 516, 180, 9)
  // tarjetas
  ;[["Rápido", "Carga en menos de 2 s"], ["Seguro", "HTTPS y buenas prácticas"], ["Medible", "Analítica y SEO base"]].forEach(([a, b], i) => {
    const x = 90 + i * 540, y = 820
    fillRR(g, x, y, 500, 200, 28, "rgba(255,255,255,.05)", "rgba(255,255,255,.1)", 1.5)
    fillRR(g, x + 34, y + 34, 56, 56, 16, "rgba(255,138,61,.16)", "rgba(255,138,61,.4)", 1.5); g.fillStyle = "#ff8a3d"; g.beginPath(); g.arc(x + 62, y + 62, 10, 0, 7); g.fill()
    txt(g, a, x + 34, y + 142, 36, "#fff", 600); txt(g, b, x + 34, y + 180, 25, "#8e96a6")
  })
  g.restore()
  return tex(c)
}

function appTex(kind) {
  const W = 780, H = 1620
  const [c, g] = canvas(W, H)
  g.fillStyle = "#0b0d13"; g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(W, 0, 10, W, 0, 700); glow.addColorStop(0, "rgba(255,138,61,.35)"); glow.addColorStop(1, "rgba(255,138,61,0)"); g.fillStyle = glow; g.fillRect(0, 0, W, H)
  txt(g, "9:41", 56, 76, 30, "#f2f4f8", 600)
  fillRR(g, 300, 40, 180, 50, 25, "#000")
  fillRR(g, 620, 52, 38, 22, 6, null, "#f2f4f8", 2.5); fillRR(g, 626, 58, 26, 10, 3, "#f2f4f8")
  if (kind === 1) {
    txt(g, "Hola", 56, 200, 40, "#8e96a6"); txt(g, "Resumen de hoy", 56, 262, 64, "#fff", 600)
    fillRR(g, 56, 320, 668, 360, 44, lin(g, 56, 320, 724, 680, [[0, "#ff9a55"], [1, "#e0521a"]]))
    txt(g, "Ventas del día", 100, 396, 32, "rgba(26,13,2,.75)", 500); txt(g, "$ 2.480.000", 100, 490, 78, "#1a0d02", 700)
    txt(g, "+12 % vs. ayer", 100, 548, 32, "rgba(26,13,2,.8)", 600)
    g.strokeStyle = "rgba(26,13,2,.7)"; g.lineWidth = 7; g.lineJoin = "round"; g.beginPath(); [0.2, 0.35, 0.28, 0.5, 0.42, 0.7, 0.62, 0.85].forEach((v, i) => { const x = 100 + i * 80, y = 650 - v * 70; i ? g.lineTo(x, y) : g.moveTo(x, y) }); g.stroke()
    ;[["Pedidos", "84"], ["Pendientes", "12"]].forEach(([a, b], i) => { const x = 56 + i * 342; fillRR(g, x, 716, 326, 170, 36, "rgba(255,255,255,.06)", "rgba(255,255,255,.1)", 1.5); txt(g, a, x + 34, 774, 30, "#8e96a6"); txt(g, b, x + 34, 846, 66, "#fff", 600) })
    txt(g, "Actividad reciente", 56, 970, 38, "#e8ebf2", 600)
    ;[["Pedido #482", "Despachado", "#4ade9d"], ["Pedido #481", "En preparación", "#ff8a3d"], ["Pedido #480", "Entregado", "#5b8cff"]].forEach((r, i) => {
      const y = 1010 + i * 150; fillRR(g, 56, y, 668, 128, 32, "rgba(255,255,255,.05)", "rgba(255,255,255,.08)", 1.5)
      fillRR(g, 86, y + 28, 72, 72, 22, "rgba(255,255,255,.08)"); fillRR(g, 106, y + 48, 32, 32, 9, r[2]); txt(g, r[0], 186, y + 64, 32, "#fff", 600); txt(g, r[1], 186, y + 104, 26, "#8e96a6")
    })
  } else {
    txt(g, "Inventario", 56, 200, 64, "#fff", 600); fillRR(g, 56, 236, 668, 80, 40, "rgba(255,255,255,.06)", "rgba(255,255,255,.1)", 1.5); txt(g, "Buscar producto…", 106, 288, 30, "#6c7384")
    ;["Todo", "Bajo stock", "Nuevo"].forEach((n, i) => { fillRR(g, 56 + i * 190, 350, 170, 62, 31, i === 0 ? "#ff8a3d" : "rgba(255,255,255,.07)"); txt(g, n, 56 + i * 190 + 85, 391, 28, i === 0 ? "#1a0d02" : "#c3c9d6", 600, "center") })
    for (let i = 0; i < 5; i++) {
      const y = 450 + i * 200; fillRR(g, 56, y, 668, 176, 36, "rgba(255,255,255,.05)", "rgba(255,255,255,.09)", 1.5)
      fillRR(g, 86, y + 28, 120, 120, 28, lin(g, 86, y, 206, y + 148, [[0, i % 2 ? "#5b8cff" : "#ff9a55"], [1, "#1c2030"]]))
      txt(g, ["Panel solar 450 W", "Inversor híbrido", "Batería 5 kWh", "Kit de montaje", "Controlador MPPT"][i], 236, y + 74, 32, "#fff", 600); txt(g, `${[128, 46, 9, 210, 31][i]} unidades`, 236, y + 118, 27, i === 2 ? "#ff8a3d" : "#8e96a6")
      fillRR(g, 236, y + 134, 380, 10, 5, "rgba(255,255,255,.08)"); fillRR(g, 236, y + 134, [330, 200, 70, 360, 150][i], 10, 5, i === 2 ? "#ff8a3d" : "#4ade9d")
    }
  }
  fillRR(g, 56, 1500, 668, 96, 48, "rgba(255,255,255,.07)", "rgba(255,255,255,.1)", 1.5)
  ;[0, 1, 2, 3].forEach((i) => { fillRR(g, 130 + i * 150, 1530, 36, 36, 10, i === (kind === 1 ? 0 : 1) ? "#ff8a3d" : "rgba(255,255,255,.28)") })
  return tex(c)
}

function iconTex(name) {
  const [c, g] = canvas(512, 512)
  fillRR(g, 0, 0, 512, 512, 90, lin(g, 0, 0, 512, 512, [[0, "#1d2029"], [1, "#0d0f14"]]))
  fillRR(g, 14, 14, 484, 484, 80, null, "rgba(255,255,255,.1)", 3)
  g.strokeStyle = "#ffa264"; g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round"
  g.shadowColor = "rgba(255,138,61,.8)"; g.shadowBlur = 24
  if (name === "db") { for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(256, 170 + i * 85, 110, 36, 0, 0, 7); g.stroke() } g.beginPath(); g.moveTo(146, 170); g.lineTo(146, 340); g.moveTo(366, 170); g.lineTo(366, 340); g.stroke() }
  if (name === "cloud") { g.beginPath(); g.arc(200, 280, 62, Math.PI * 0.5, Math.PI * 1.5); g.arc(270, 215, 78, Math.PI, Math.PI * 1.95); g.arc(340, 285, 58, Math.PI * 1.5, Math.PI * 0.5); g.closePath(); g.stroke() }
  if (name === "api") { g.beginPath(); g.moveTo(190, 170); g.lineTo(110, 256); g.lineTo(190, 342); g.moveTo(322, 170); g.lineTo(402, 256); g.lineTo(322, 342); g.moveTo(286, 150); g.lineTo(226, 362); g.stroke() }
  if (name === "cart") { g.beginPath(); g.moveTo(110, 150); g.lineTo(170, 150); g.lineTo(206, 320); g.lineTo(380, 320); g.lineTo(412, 200); g.lineTo(184, 200); g.stroke(); g.beginPath(); g.arc(230, 380, 16, 0, 7); g.arc(360, 380, 16, 0, 7); g.stroke() }
  if (name === "shield") { g.beginPath(); g.moveTo(256, 100); g.lineTo(390, 150); g.lineTo(390, 270); g.quadraticCurveTo(390, 370, 256, 420); g.quadraticCurveTo(122, 370, 122, 270); g.lineTo(122, 150); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(200, 262); g.lineTo(244, 306); g.lineTo(316, 220); g.stroke() }
  if (name === "erp") { g.strokeRect(118, 130, 276, 252); g.beginPath(); g.moveTo(118, 210); g.lineTo(394, 210); g.moveTo(222, 210); g.lineTo(222, 382); g.stroke() }
  return tex(c)
}

/* ---------------------------------------------------------------- escena base */
function bgTexture(w, h, warm = [0.82, 0.86], cool = [0.12, 0.1]) {
  const [c, g] = canvas(w, h)
  g.fillStyle = "#08090d"; g.fillRect(0, 0, w, h)
  let r = g.createRadialGradient(w * warm[0], h * warm[1], 0, w * warm[0], h * warm[1], Math.max(w, h) * 0.75); r.addColorStop(0, "rgba(255,120,40,.20)"); r.addColorStop(1, "rgba(255,120,40,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h)
  r = g.createRadialGradient(w * cool[0], h * cool[1], 0, w * cool[0], h * cool[1], Math.max(w, h) * 0.7); r.addColorStop(0, "rgba(70,110,255,.16)"); r.addColorStop(1, "rgba(70,110,255,0)"); g.fillStyle = r; g.fillRect(0, 0, w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

function setup(w, h, fov = 30) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1); renderer.setSize(w, h)
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  document.body.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = bgTexture(w, h)
  const pm = new THREE.PMREMGenerator(renderer)
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.32
  const camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 100)
  const key = new THREE.DirectionalLight(0xdfe8ff, 2.4); key.position.set(-4, 6, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 30 }); scene.add(key)
  const warm = new THREE.PointLight(ORANGE, 90, 0, 2); warm.position.set(5, -1.2, 3.5); scene.add(warm)
  const warm2 = new THREE.PointLight(0xff7a2a, 60, 0, 2); warm2.position.set(-1, -3, -3); scene.add(warm2)
  const cool = new THREE.PointLight(BLUE, 55, 0, 2); cool.position.set(-6, 2, 1); scene.add(cool)
  const composer = new EffectComposer(renderer)
  composer.setSize(w, h)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.6, 0.92))
  composer.addPass(new OutputPass())
  return { renderer, scene, camera, composer }
}

const MAT = {
  titanium: () => new THREE.MeshStandardMaterial({ color: 0x2a2d35, metalness: 1, roughness: 0.28 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x0f1116, metalness: 0.6, roughness: 0.4 }),
  glass: (o = 0.1) => new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: o, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.1, depthWrite: false }),
  glow: (c = ORANGE, i = 2.4) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i, toneMapped: false }),
  orangeMetal: () => new THREE.MeshStandardMaterial({ color: 0xff7a2a, metalness: 0.85, roughness: 0.3 }),
  screen: (t, k = 0.95) => new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(k, k, k), toneMapped: true }),
}

/** Pantalla/ventana con marco metalico, cristal y filo naranja. */
function panel(w, h, t, { depth = 0.12, bezel = 0.07, radius = 0.1, edge = true } = {}) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new RoundedBoxGeometry(w + bezel * 2, h + bezel * 2, depth, 5, radius), MAT.titanium()); body.castShadow = true; g.add(body)
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.screen(t)); scr.position.z = depth / 2 + 0.002; g.add(scr)
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.glass(0.03)); gl.position.z = depth / 2 + 0.006; g.add(gl)
  if (edge) { const e = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.012, 0.012), MAT.glow(ORANGE, 2.2)); e.position.set(0, -(h / 2 + bezel) + 0.004, depth / 2 - 0.004); g.add(e) }
  return g
}

function blob(w, h, a = 0.55) {
  const [c, g] = canvas(256, 256); const r = g.createRadialGradient(128, 128, 4, 128, 128, 126); r.addColorStop(0, `rgba(0,0,0,${a})`); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 256, 256)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }))
  m.rotation.x = -Math.PI / 2; return m
}

function dust(scene, n, sx, sy, sz, seed = 3) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const geo = new THREE.SphereGeometry(0.011, 8, 8)
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, MAT.glow(rnd() > 0.35 ? ORANGE : 0x9db8ff, 2.5 + rnd() * 2)); const k = 0.6 + rnd() * 1.6; m.scale.setScalar(k)
    m.position.set((rnd() - 0.5) * sx, (rnd() - 0.5) * sy, (rnd() - 0.5) * sz); scene.add(m)
  }
}

function tube(points, radius = 0.025, mat = MAT.glow(ORANGE, 2.6)) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.4)
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 96, radius, 12, false), mat)
}

/* ---------------------------------------------------------------- 1 · software a medida */
function sceneSoftware(S) {
  const { scene, camera } = S
  camera.position.set(0.1, 0.3, 11.8); camera.lookAt(-0.1, -0.15, 0)
  const root = new THREE.Group(); scene.add(root)
  // panel principal
  const main = panel(5.1, 3.2, dashboardTex(), { depth: 0.16, radius: 0.12 }); main.position.set(0.55, -0.05, 0.2); main.rotation.set(0.06, -0.36, 0.015); root.add(main)
  // editor de codigo detras
  const code = panel(3.5, 2.19, codeTex(), { depth: 0.12, radius: 0.1 }); code.position.set(-2.55, 1.05, -1.6); code.rotation.set(-0.02, 0.5, -0.03); root.add(code)
  // tarjeta de cristal delante
  const [c, g] = canvas(900, 560)
  fillRR(g, 6, 6, 888, 548, 60, lin(g, 0, 0, 900, 560, [[0, "rgba(28,32,44,.92)"], [1, "rgba(12,14,20,.92)"]]), "rgba(255,255,255,.2)", 3)
  txt(g, "Entregas a tiempo", 60, 110, 42, "#aab1c0", 500); txt(g, "96,4 %", 60, 230, 120, "#fff", 700)
  g.strokeStyle = "#4ade9d"; g.lineWidth = 9; g.lineJoin = "round"; g.beginPath(); [0.3, 0.4, 0.34, 0.55, 0.5, 0.72, 0.66, 0.9].forEach((v, i) => { const x = 60 + i * 110, y = 480 - v * 170; i ? g.lineTo(x, y) : g.moveTo(x, y) }); g.stroke()
  g.lineTo(830, 520); g.lineTo(60, 520); g.closePath(); g.fillStyle = lin(g, 0, 300, 0, 520, [[0, "rgba(74,222,157,.28)"], [1, "rgba(74,222,157,0)"]]); g.fill()
  const card = new THREE.Mesh(new RoundedBoxGeometry(2.3, 1.43, 0.08, 4, 0.1), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); card.position.set(2.75, -1.55, 1.55); card.rotation.set(0.05, -0.3, 0.02); root.add(card)
  const cardGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.43), MAT.glass(0.08)); cardGlass.position.z = 0.045; card.add(cardGlass)
  // modulo flotante
  const ico = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.95, 0.95, 5, 0.16), [0, 1, 2, 3, 4, 5].map(() => MAT.titanium())); ico.material[4] = new THREE.MeshBasicMaterial({ map: iconTex("api") }); ico.position.set(-3.7, -1.85, 1.0); ico.rotation.set(0.5, 0.65, 0.1); ico.castShadow = true; root.add(ico)
  const sh = blob(7, 3, 0.5); sh.position.set(0.3, -2.45, 0.2); root.add(sh)
  dust(scene, 26, 11, 6.5, 5, 7)
}

/* ---------------------------------------------------------------- 2 · desarrollo web */
function sceneWeb(S) {
  const { scene, camera } = S
  camera.position.set(0, 0.2, 7.0); camera.lookAt(0, -0.05, 0)
  const back = panel(3.1, 2.04, (() => { const [c, g] = canvas(1500, 990); g.fillStyle = "#f3f1ee"; g.fillRect(0, 0, 1500, 990); g.fillStyle = "#e5e1db"; g.fillRect(0, 0, 1500, 80); fillRR(g, 90, 170, 700, 120, 12, "#1c1e26"); fillRR(g, 90, 320, 520, 60, 10, "#cfc8bd"); fillRR(g, 900, 150, 480, 520, 30, lin(g, 900, 150, 1380, 670, [[0, "#ff9a55"], [1, "#d6451a"]])); for (let i = 0; i < 3; i++) fillRR(g, 90 + i * 430, 740, 390, 190, 24, "#fff", "#ddd5c9", 2); return tex(c) })(), { depth: 0.08, radius: 0.08, edge: false })
  back.position.set(-2.65, 0.35, -1.5); back.rotation.set(0.03, 0.42, 0.02); scene.add(back)
  const main = panel(5.3, 3.5, siteTex(), { depth: 0.14, bezel: 0.06, radius: 0.12 }); main.position.set(0.55, -0.1, 0.3); main.rotation.set(0.05, -0.3, 0.015); scene.add(main)
  const sh = blob(7, 2.6, 0.5); sh.position.set(0.2, -2.1, 0.2); scene.add(sh)
  dust(scene, 18, 10, 5, 4, 11)
}

/* ---------------------------------------------------------------- 3 · aplicaciones moviles */
function phone(t) {
  const g = new THREE.Group(), w = 0.95, h = 2.0, d = 0.12
  const body = new THREE.Mesh(new RoundedBoxGeometry(w + 0.06, h + 0.06, d, 6, 0.22), MAT.titanium()); body.castShadow = true; g.add(body)
  const bez = new THREE.Mesh(new RoundedBoxGeometry(w, h, d + 0.004, 6, 0.19), new THREE.MeshStandardMaterial({ color: 0x050608, metalness: 0.3, roughness: 0.3 })); g.add(bez)
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.07, h - 0.07), MAT.screen(t, 1)); scr.position.z = d / 2 + 0.004; g.add(scr)
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.07, h - 0.07), MAT.glass(0.07)); gl.position.z = d / 2 + 0.008; g.add(gl)
  // botones laterales
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.28, 0.05, 2, 0.01), MAT.titanium()); b.position.set(w / 2 + 0.04, 0.35, 0); g.add(b)
  return g
}
function sceneMobile(S) {
  const { scene, camera } = S
  camera.position.set(0, 0.1, 5.3); camera.lookAt(0, -0.05, 0)
  const a = phone(appTex(2)); a.position.set(-1.35, 0.05, -0.6); a.rotation.set(0.06, 0.38, -0.06); scene.add(a)
  const b = phone(appTex(1)); b.position.set(0.2, -0.05, 0.6); b.rotation.set(0.04, -0.28, 0.05); b.scale.setScalar(1.12); scene.add(b)
  // ventana flotante de notificacion
  const [c, g] = canvas(700, 190); fillRR(g, 4, 4, 692, 182, 46, "rgba(18,21,30,.94)", "rgba(255,255,255,.2)", 3); fillRR(g, 36, 36, 118, 118, 34, lin(g, 36, 36, 154, 154, [[0, "#ffab70"], [1, "#ff6a1a"]])); txt(g, "Nuevo pedido", 184, 90, 40, "#fff", 600); txt(g, "Sucursal Centro · hace 1 min", 184, 138, 30, "#8e96a6")
  const n = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.57, 0.05, 4, 0.12), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); n.position.set(1.45, 0.95, 1.3); n.scale.setScalar(0.88); n.rotation.set(0.04, -0.3, 0.03); scene.add(n)
  const sh = blob(6, 2.2, 0.5); sh.position.set(0, -2.1, 0.2); scene.add(sh)
  dust(scene, 16, 9, 5, 4, 5)
}

/* ---------------------------------------------------------------- 4 · integraciones */
function cubeWith(name, size = 1.1) {
  const mats = [0, 1, 2, 3, 4, 5].map(() => MAT.titanium())
  const t = new THREE.MeshBasicMaterial({ map: iconTex(name) }); mats[4] = t
  const m = new THREE.Mesh(new RoundedBoxGeometry(size, size, size, 5, size * 0.17), mats); m.castShadow = true
  const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.74, 0.012, 8, 64), MAT.glow(ORANGE, 2.6)); ring.rotation.x = Math.PI / 2; ring.position.y = -size / 2 - 0.12
  const g = new THREE.Group(); g.add(m, ring); return g
}
function sceneIntegration(S) {
  const { scene, camera } = S
  camera.position.set(0, 3.4, 10.2); camera.lookAt(0, -0.1, 0)
  const hub = new THREE.Mesh(new RoundedBoxGeometry(1.8, 1.8, 1.8, 6, 0.3), [0, 1, 2, 3, 4, 5].map(() => MAT.titanium())); hub.material[4] = new THREE.MeshBasicMaterial({ map: iconTex("erp") }); hub.rotation.set(0.0, 0.5, 0); hub.castShadow = true; scene.add(hub)
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.02, 10, 96), MAT.glow(ORANGE, 3)); hubRing.rotation.x = Math.PI / 2; hubRing.position.y = -1.05; scene.add(hubRing)
  const hubRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.01, 10, 96), MAT.glow(0x9db8ff, 1.6)); hubRing2.rotation.x = Math.PI / 2; hubRing2.position.y = -1.05; scene.add(hubRing2)
  const nodes = [["cloud", -4.1, 0.55, -0.4], ["db", -2.5, -0.35, 1.7], ["cart", 2.6, -0.35, 1.7], ["shield", 4.1, 0.55, -0.4]]
  nodes.forEach(([n, x, y, z], i) => { const c = cubeWith(n, 1.15); c.position.set(x, y, z); c.rotation.y = 0.5 - i * 0.2; c.rotation.x = 0; scene.add(c)
    const mid = [(x * 0.5), 0.9 + (i % 2) * 0.2, z * 0.5 + 0.3]
    scene.add(tube([[x * 0.92, y + 0.1, z * 0.92], mid, [x * 0.2, 0.15, z * 0.2 + 0.1]], 0.028)) })
  // paquetes de datos sobre los cables
  const pk = new THREE.BoxGeometry(0.14, 0.14, 0.14)
  ;[[-2.9, 0.82, 0.25], [-1.2, 0.95, 0.5], [1.3, 0.95, 0.5], [2.9, 0.82, 0.25]].forEach((p) => { const m = new THREE.Mesh(pk, MAT.glow(0xffffff, 3)); m.position.set(...p); m.rotation.set(0.5, 0.6, 0); scene.add(m) })
  // plataforma
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.8, 0.12, 96), new THREE.MeshStandardMaterial({ color: 0x0e1015, metalness: 0.8, roughness: 0.38 })); plat.position.y = -1.45; plat.receiveShadow = true; scene.add(plat)
  const platEdge = new THREE.Mesh(new THREE.TorusGeometry(5.7, 0.02, 8, 160), MAT.glow(ORANGE, 2)); platEdge.rotation.x = Math.PI / 2; platEdge.position.y = -1.39; scene.add(platEdge)
  dust(scene, 18, 10, 4, 5, 13)
}

/* ---------------------------------------------------------------- 5 · automatizacion */
function gear(r = 1, teeth = 14, thick = 0.28, hole = 0.28) {
  const s = new THREE.Shape(), step = (Math.PI * 2) / teeth
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    const p = [[a, r * 0.86], [a + step * 0.12, r * 0.86], [a + step * 0.24, r * 1.12], [a + step * 0.5, r * 1.12], [a + step * 0.62, r * 0.86]]
    p.forEach(([an, rad], k) => { const x = Math.cos(an) * rad, y = Math.sin(an) * rad; i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y) })
  }
  s.closePath(); const h = new THREE.Path(); h.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(h)
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 24 }); geo.translate(0, 0, -thick / 2)
  return geo
}
function sceneAutomation(S) {
  const { scene, camera } = S
  camera.position.set(0.2, 2.2, 9.4); camera.lookAt(0, -0.2, 0)
  const root = new THREE.Group(); root.rotation.set(-0.5, 0.28, 0); scene.add(root)
  const g1 = new THREE.Mesh(gear(1.35, 16, 0.36, 0.38), MAT.titanium()); g1.position.set(-0.9, 0.35, 0); g1.castShadow = true; root.add(g1)
  const g1r = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 12, 64), MAT.glow(ORANGE, 3)); g1r.position.copy(g1.position); g1r.position.z = 0.22; root.add(g1r)
  const g2 = new THREE.Mesh(gear(0.85, 10, 0.34, 0.26), MAT.orangeMetal()); g2.position.set(1.1, -0.35, 0); g2.rotation.z = 0.2; g2.castShadow = true; root.add(g2)
  const g3 = new THREE.Mesh(gear(0.55, 8, 0.3, 0.18), MAT.titanium()); g3.position.set(0.55, 1.35, 0); g3.rotation.z = 0.12; g3.castShadow = true; root.add(g3)
  // carril de proceso con nodos
  const path = [[-3.4, -1.55, 0.3], [-1.6, -1.85, 0.6], [0.4, -1.6, 0.9], [2.3, -1.9, 0.6], [3.5, -1.4, 0.3]]
  root.add(tube(path, 0.035))
  ;[[-2.6, -1.72, 0.45], [-0.3, -1.72, 0.8], [1.6, -1.78, 0.78], [3.2, -1.55, 0.4]].forEach((p, i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.62, 4, 0.12), MAT.titanium()); m.position.set(p[0], p[1] + 0.35, p[2]); m.rotation.y = 0.4; m.castShadow = true
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), MAT.glow(i === 3 ? 0x4ade9d : ORANGE, 2.6)); top.rotation.x = -Math.PI / 2; top.position.set(p[0], p[1] + 0.665, p[2]); top.rotation.z = 0.4
    root.add(m, top)
  })
  const sh = blob(8, 3, 0.45); sh.position.set(0, -2.2, 0.4); scene.add(sh)
  dust(scene, 14, 9, 5, 4, 17)
}

/* ---------------------------------------------------------------- 6 · arquitectura */
function sceneArchitecture(S) {
  const { scene, camera } = S
  camera.position.set(0, 2.4, 10.2); camera.lookAt(0, 0.0, 0)
  const root = new THREE.Group(); root.rotation.y = -0.55; root.position.set(-0.4, 0, 0); scene.add(root)
  const layers = [
    { y: -1.55, c: 0x12141a, label: "datos", n: 4 },
    { y: -0.55, c: 0x161922, label: "servicios", n: 3 },
    { y: 0.45, c: 0x1a1e29, label: "api", n: 3 },
    { y: 1.45, c: 0x1f2431, label: "interfaz", n: 2 },
  ]
  layers.forEach((L, li) => {
    const slab = new THREE.Mesh(new RoundedBoxGeometry(5.2, 0.16, 3.4, 4, 0.06), new THREE.MeshStandardMaterial({ color: L.c, metalness: 0.5, roughness: 0.45, envMapIntensity: 0.6 })); slab.position.y = L.y; slab.castShadow = true; slab.receiveShadow = true; root.add(slab)
    const glass = new THREE.Mesh(new RoundedBoxGeometry(5.2, 0.17, 3.4, 4, 0.06), MAT.glass(0.05)); glass.position.y = L.y; root.add(glass)
    const edge = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.014, 0.014), MAT.glow(ORANGE, 2.4)); edge.position.set(0, L.y - 0.07, 1.7); root.add(edge)
    const edge2 = edge.clone(); edge2.rotation.y = Math.PI / 2; edge2.scale.x = 0.66; edge2.position.set(2.6, L.y - 0.07, 0); root.add(edge2)
    for (let i = 0; i < L.n; i++) {
      const w = L.n === 2 ? 1.7 : 1.1, x = (i - (L.n - 1) / 2) * (L.n === 2 ? 2.2 : 1.55)
      const mod = new THREE.Mesh(new RoundedBoxGeometry(w, 0.34 + (li === 0 ? 0.1 : 0), 0.9, 4, 0.07), MAT.titanium()); mod.position.set(x, L.y + 0.25, 0); mod.castShadow = true; root.add(mod)
      const led = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.03, 0.03), MAT.glow(i % 3 === 1 ? 0x9db8ff : ORANGE, 3)); led.position.set(x, L.y + 0.27, 0.46); root.add(led)
    }
  })
  // haces verticales
  ;[[-2.2, -1.2], [2.2, 1.0], [0, 0]].forEach(([x, z]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.0, 8), MAT.glow(ORANGE, 2.2)); b.position.set(x, 0, z); root.add(b) })
  dust(scene, 16, 9, 6, 4, 23)
}

/* ---------------------------------------------------------------- arranque */
const id = new URLSearchParams(location.search).get("scene") || "s1"
const cfg = SCENES[id]
const S = setup(cfg.w, cfg.h)
cfg.build(S)
S.composer.render()
window.__ready = { id, w: cfg.w, h: cfg.h }
