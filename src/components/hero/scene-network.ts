import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"

// Escena 3D del hero de la portada: red de nodos metalicos.
// Nodos de metal oscuro iluminados por un entorno de estudio generado por codigo (sin HDRI descargado), conexiones de acero
// y pulsos de luz que viajan por la red. Todo el movimiento es autonomo (sin depender del scroll).
// Costo acotado: nodos y conexiones son InstancedMesh (2 draw calls), los pulsos son un unico Points, sin sombras dinamicas.

export type NetworkHandle = {
  setVisible: (v: boolean) => void
  resize: () => void
  dispose: () => void
}

type Opts = {
  canvas: HTMLCanvasElement
  /** Telefono o pantalla pequena: menos nodos, menos pulsos, 30 fps. */
  mobile: boolean
  /** prefers-reduced-motion: se dibuja un solo cuadro y no hay bucle de animacion. */
  still: boolean
  /** El contexto WebGL se perdio: el llamador muestra la version estatica. */
  onLost?: () => void
  /** Devuelve true si el hero se desmonto mientras la escena se construia (se libera todo y se devuelve null). */
  cancelled?: () => boolean
}

const CYAN = new THREE.Color("#5ee6ff")
const ORANGE = new THREE.Color("#ff7a1a")

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// La escena se construye en varias tareas cortas (cada `await` cede el hilo al navegador) para no crear una tarea larga
// que bloquee el hilo principal: contexto WebGL, entorno de reflejos, geometria y compilacion de shaders van por separado.
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

export async function createNetworkScene({ canvas, mobile, still, onLost, cancelled }: Opts): Promise<NetworkHandle | null> {
  const rnd = mulberry32(20261028)
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "default" })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const dprCap = mobile ? 1.5 : 1.75
  await tick()
  if (cancelled?.()) {
    renderer.dispose()
    renderer.forceContextLoss()
    return null
  }

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)

  // Entorno de reflejos: una sala de estudio procedural. Se genera una vez y se libera el generador.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  await tick()
  if (cancelled?.()) {
    envTex.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    return null
  }
  scene.environment = envTex
  scene.environmentIntensity = 0.85

  // Luces de color: reflejos cian y naranja sobre el metal (identidad de marca) y un contraluz neutro.
  scene.add(new THREE.AmbientLight(0x8fa6d6, 0.18))
  const keyCyan = new THREE.PointLight(CYAN, 70, 0, 2)
  keyCyan.position.set(-7, 5, 7)
  const keyOrange = new THREE.PointLight(ORANGE, 55, 0, 2)
  keyOrange.position.set(7, -4, 6)
  const rim = new THREE.DirectionalLight(0xdfe9ff, 0.9)
  rim.position.set(3, 6, -6)
  scene.add(keyCyan, keyOrange, rim)

  const root = new THREE.Group()
  scene.add(root)

  // ---- Nodos ---------------------------------------------------------------------------------
  const N = mobile ? 30 : 46
  const RX = mobile ? 3.7 : 4.2
  const RY = mobile ? 3.3 : 3.1
  const RZ = 3.0
  const pts: THREE.Vector3[] = []
  for (let guard = 0; pts.length < N && guard < 8000; guard++) {
    const th = rnd() * Math.PI * 2
    const ph = Math.acos(2 * rnd() - 1)
    const r = Math.cbrt(rnd())
    const p = new THREE.Vector3(RX * r * Math.sin(ph) * Math.cos(th), RY * r * Math.sin(ph) * Math.sin(th), RZ * r * Math.cos(ph))
    if (pts.every((q) => q.distanceTo(p) > 1.15)) pts.push(p)
  }
  const n = pts.length

  // Concentradores: los 4 nodos mas centrales separados entre si.
  const byCenter = pts.map((_, i) => i).sort((a, b) => pts[a].length() - pts[b].length())
  const hubs: number[] = []
  for (const i of byCenter) {
    if (hubs.length >= 4) break
    if (hubs.every((h) => pts[h].distanceTo(pts[i]) > 2.6)) hubs.push(i)
  }
  const isHub = new Set(hubs)

  const nodeGeo = new THREE.SphereGeometry(1, mobile ? 20 : 32, mobile ? 14 : 22)
  const nodeMat = mobile
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.3 })
    : new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 })
  const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, n)
  const m4 = new THREE.Matrix4()
  const tint = new THREE.Color()
  const steel = ["#2f3a52", "#38445f", "#28324a", "#3f4c69"]
  pts.forEach((p, i) => {
    const s = isHub.has(i) ? 0.42 : 0.15 + rnd() * 0.1
    m4.makeScale(s, s, s).setPosition(p)
    nodes.setMatrixAt(i, m4)
    tint.set(isHub.has(i) ? "#55617e" : steel[i % steel.length])
    nodes.setColorAt(i, tint)
  })
  nodes.instanceMatrix.needsUpdate = true
  if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true
  root.add(nodes)

  // ---- Conexiones ----------------------------------------------------------------------------
  const edgeSet = new Set<string>()
  const edges: [number, number][] = []
  const link = (a: number, b: number) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`
    if (a === b || edgeSet.has(k)) return
    edgeSet.add(k)
    edges.push([a, b])
  }
  for (let i = 0; i < n; i++) {
    const near = pts
      .map((p, j) => ({ j, d: p.distanceTo(pts[i]) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
    const k = isHub.has(i) ? 5 : 2
    near.slice(0, k).forEach((o) => link(i, o.j))
  }
  const adj: number[][] = Array.from({ length: n }, () => [])
  edges.forEach(([a, b], e) => {
    adj[a].push(e)
    adj[b].push(e)
  })

  const wireGeo = new THREE.CylinderGeometry(0.011, 0.011, 1, 6, 1, true)
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x33415f, metalness: 0.9, roughness: 0.4, emissive: 0x1a7ea6, emissiveIntensity: 0.28 })
  const wires = new THREE.InstancedMesh(wireGeo, wireMat, edges.length)
  const up = new THREE.Vector3(0, 1, 0)
  const q = new THREE.Quaternion()
  const one = new THREE.Vector3(1, 1, 1)
  edges.forEach(([a, b], e) => {
    const d = new THREE.Vector3().subVectors(pts[b], pts[a])
    const len = d.length()
    q.setFromUnitVectors(up, d.normalize())
    m4.compose(new THREE.Vector3().addVectors(pts[a], pts[b]).multiplyScalar(0.5), q, one.clone().set(1, len, 1))
    wires.setMatrixAt(e, m4)
  })
  wires.instanceMatrix.needsUpdate = true
  root.add(wires)

  // ---- Puntos luminosos: pulsos con cola, resplandor de concentradores y polvo de fondo ---------
  const glowMat = (scale: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uPx: { value: 1 }, uScale: { value: scale } },
      vertexShader: `
        attribute float aSize; varying vec3 vC; uniform float uPx; uniform float uScale;
        void main(){
          vC = color;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * uPx * (uScale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vC;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = pow(smoothstep(0.5, 0.0, d), 1.6);
          gl_FragColor = vec4(vC * a, a);
        }`,
    })
  const pointsOf = (count: number, mat: THREE.ShaderMaterial, dynamic = false) => {
    const g = new THREE.BufferGeometry()
    const pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    if (dynamic) pos.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute("position", pos)
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1))
    const obj = new THREE.Points(g, mat)
    obj.frustumCulled = false
    return { obj, pos, col: g.getAttribute("color") as THREE.BufferAttribute, size: g.getAttribute("aSize") as THREE.BufferAttribute }
  }

  const TAIL = 3
  const M = mobile ? 16 : 34
  const pulseMat = glowMat(30)
  const pulseP = pointsOf(M * TAIL, pulseMat, true)
  root.add(pulseP.obj)
  const pulses = Array.from({ length: M }, (_, i) => {
    const e = Math.floor(rnd() * edges.length)
    const warm = i % 6 === 0
    return { e, from: edges[e][0], t: rnd(), speed: 0.22 + rnd() * 0.3, color: warm ? ORANGE : CYAN }
  })
  const tailK = [1, 0.5, 0.22]
  const tailS = [10, 6.5, 4]
  const tailOff = [0, 0.05, 0.1]
  pulses.forEach((p, i) => {
    for (let k = 0; k < TAIL; k++) {
      pulseP.size.setX(i * TAIL + k, tailS[k])
      pulseP.col.setXYZ(i * TAIL + k, p.color.r * tailK[k], p.color.g * tailK[k], p.color.b * tailK[k])
    }
  })
  pulseP.size.needsUpdate = true
  pulseP.col.needsUpdate = true

  const hubGlow = pointsOf(hubs.length, glowMat(30))
  hubs.forEach((h, i) => {
    hubGlow.pos.setXYZ(i, pts[h].x, pts[h].y, pts[h].z)
    const c = i % 2 === 0 ? CYAN : ORANGE
    hubGlow.col.setXYZ(i, c.r * 0.5, c.g * 0.5, c.b * 0.5)
    hubGlow.size.setX(i, 15)
  })
  root.add(hubGlow.obj)

  const DUST = mobile ? 50 : 130
  const dustMat = glowMat(24)
  const dust = pointsOf(DUST, dustMat)
  for (let i = 0; i < DUST; i++) {
    const r = 5.2 + rnd() * 5
    const th = rnd() * Math.PI * 2
    const ph = Math.acos(2 * rnd() - 1)
    dust.pos.setXYZ(i, r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th) * 0.8, r * Math.cos(ph))
    const c = rnd() > 0.85 ? ORANGE : CYAN
    const k = 0.1 + rnd() * 0.16
    dust.col.setXYZ(i, c.r * k, c.g * k, c.b * k)
    dust.size.setX(i, 0.8 + rnd() * 1.5)
  }
  root.add(dust.obj)

  // ---- Estado --------------------------------------------------------------------------------
  let width = 1
  let height = 1
  let time = 0
  let inView = true
  let raf = 0
  let last = 0
  let lastRender = 0
  const minFrame = 1000 / (mobile ? 30 : 45)
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const onPointer = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
  }
  if (!mobile && !still) window.addEventListener("pointermove", onPointer, { passive: true })

  const tmpA = new THREE.Vector3()
  const tmpB = new THREE.Vector3()
  function updatePulses(dt: number) {
    for (let i = 0; i < M; i++) {
      const p = pulses[i]
      p.t += p.speed * dt
      if (p.t >= 1) {
        const [a, b] = edges[p.e]
        const to = p.from === a ? b : a
        const options = adj[to].filter((e) => e !== p.e)
        const list = options.length ? options : adj[to]
        p.e = list[Math.floor(rnd() * list.length)]
        p.from = to
        p.t = 0
      }
      const [a, b] = edges[p.e]
      const toIdx = p.from === a ? b : a
      for (let k = 0; k < TAIL; k++) {
        const t = Math.max(0, p.t - tailOff[k])
        tmpA.copy(pts[p.from])
        tmpB.copy(pts[toIdx])
        tmpA.lerp(tmpB, t)
        pulseP.pos.setXYZ(i * TAIL + k, tmpA.x, tmpA.y, tmpA.z)
      }
    }
    pulseP.pos.needsUpdate = true
  }

  function pose(dt: number) {
    time += dt
    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    root.rotation.y = time * 0.07 + pointer.x * 0.22
    root.rotation.x = 0.16 + Math.sin(time * 0.21) * 0.07 + pointer.y * 0.1
    root.position.y = Math.sin(time * 0.45) * 0.07
    dust.obj.rotation.y = -time * 0.02
    updatePulses(dt)
  }

  function resize() {
    const r = canvas.getBoundingClientRect()
    width = Math.max(1, r.width)
    height = Math.max(1, r.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    // Distancia para que la esfera envolvente de la red (radio efectivo ~4) quepa en el lado menor de la vista.
    const v = (camera.fov * Math.PI) / 180
    const h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect)
    camera.position.set(0, 0, (mobile ? 3.7 : 4.3) / Math.sin(Math.min(v, h) / 2))
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    const px = renderer.getPixelRatio()
    pulseMat.uniforms.uPx.value = px
    dustMat.uniforms.uPx.value = px
    ;(hubGlow.obj.material as THREE.ShaderMaterial).uniforms.uPx.value = px
    const dist = camera.position.z
    scene.fog = new THREE.Fog(0x060a14, dist - 1.5, dist + 7.5)
    if (still) draw()
  }

  function draw() {
    renderer.render(scene, camera)
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    if (now - lastRender < minFrame) return
    lastRender = now
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    pose(dt)
    draw()
  }
  function start() {
    if (raf || still) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  const onLostCtx = (e: Event) => {
    e.preventDefault()
    stop()
    onLost?.()
  }
  canvas.addEventListener("webglcontextlost", onLostCtx)
  const onVis = () => (document.hidden || !inView ? stop() : start())
  document.addEventListener("visibilitychange", onVis)

  const dispose = () => {
    stop()
    window.removeEventListener("pointermove", onPointer)
    canvas.removeEventListener("webglcontextlost", onLostCtx)
    document.removeEventListener("visibilitychange", onVis)
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    envTex.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }

  resize()
  await tick()
  if (cancelled?.()) {
    dispose()
    return null
  }
  // Compilacion de shaders sin bloquear (KHR_parallel_shader_compile); si no hay soporte, three compila en el primer render.
  try {
    await renderer.compileAsync(scene, camera)
  } catch {
    /* se compilara en el primer render */
  }
  if (cancelled?.()) {
    dispose()
    return null
  }
  if (still) {
    pose(7) // un cuadro fijo, bien compuesto
    draw()
  } else {
    start()
  }

  return {
    setVisible: (v) => {
      inView = v
      onVis()
    },
    resize,
    dispose,
  }
}
