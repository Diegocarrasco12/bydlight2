import * as THREE from "three"
import type { NetworkHandle } from "./scene-network"

// Escena 3D del hero de ESCRITORIO (Fase 5, alternativa C «Enterprise Technology Cinematic»): red de nodos metalicos sobre la
// fotografia de centro de datos del fondo. La fotografia tambien alimenta el entorno de reflejos (PMREM), asi el metal refleja los
// mismos racks, azules y acentos calidos que se ven detras: iluminacion coherente, no una foto con un objeto pegado.
// En movil NO se usa (rige scene-network, aprobada). Costo: nodos y cables son InstancedMesh, pulsos y brillos son Points;
// sin sombras dinamicas ni postprocesado.

type Opts = {
  canvas: HTMLCanvasElement
  /** URL de la fotografia (misma del fondo) para el entorno de reflejos. Si falla, se usa solo la sala de estudio. */
  envUrl: string
  /** prefers-reduced-motion: un solo cuadro, sin bucle. */
  still: boolean
  onLost?: () => void
  cancelled?: () => boolean
}

const CYAN = new THREE.Color("#5ee6ff")
const ORANGE = new THREE.Color("#ff7a1a")
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

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

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image()
    img.decoding = "async"
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = url
  })
}

/** Entorno: la fotografia (atenuada y teñida al azul de marca) en una esfera + cajas de luz de estudio para reflejos nitidos. */
function environmentScene(photo: THREE.Texture | null) {
  const s = new THREE.Scene()
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(30, 32, 20),
    new THREE.MeshBasicMaterial(photo ? { map: photo, color: new THREE.Color(0.62, 0.74, 1.0), side: THREE.BackSide } : { color: 0x0a101e, side: THREE.BackSide }),
  )
  s.add(dome)
  const box = (w: number, h: number, pos: [number, number, number], color: string, k: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.lookAt(0, 0, 0)
    s.add(m)
  }
  box(12, 6, [-10, 9, 7], "#dfe9ff", 5) // caja fria principal (como los fluorescentes del techo de la foto)
  box(1.4, 14, [13, 1, 4], "#ff9a4a", 4) // tira calida (cables y LEDs naranjas de los racks)
  box(18, 1.2, [0, 7, -12], "#7fe8ff", 4) // contraluz cian
  box(26, 14, [0, 1, 17], "#9fb2d8", 1.1) // relleno frontal: de cara, el metal refleja acero claro y no negro
  box(20, 5, [0, -9, 4], "#4a6cb0", 1.2) // relleno inferior azul
  return s
}

export async function createHeroScene({ canvas, envUrl, still, onLost, cancelled }: Opts): Promise<NetworkHandle | null> {
  const rnd = mulberry32(20261030)
  // Se pide el contexto antes de crear el renderer: sin WebGL el respaldo es silencioso (three.js escribe errores en consola si falla solo).
  const attrs: WebGLContextAttributes = { alpha: true, antialias: true, powerPreference: "default" }
  const gl = canvas.getContext("webgl2", attrs)
  if (!gl) return null
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, ...attrs })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.06
  const dprCap = 1.75
  const abort = () => {
    renderer.dispose()
    renderer.forceContextLoss()
    return null
  }
  await tick()
  if (cancelled?.()) return abort()

  const img = await loadImage(envUrl)
  if (cancelled?.()) return abort()
  let photo: THREE.Texture | null = null
  if (img) {
    // El PMREM (cubo de 256 px por cara) no aprovecha mas de ~1024 px de ancho: se reduce antes de subirla a la GPU (la original pesa ~10 MB descomprimida).
    const cw = Math.min(1024, img.naturalWidth)
    const ch = Math.round((cw * img.naturalHeight) / img.naturalWidth)
    const cv = document.createElement("canvas")
    cv.width = cw
    cv.height = ch
    cv.getContext("2d")!.drawImage(img, 0, 0, cw, ch)
    photo = new THREE.Texture(cv)
    photo.colorSpace = THREE.SRGBColorSpace
    photo.needsUpdate = true
  }
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = environmentScene(photo)
  const envTex = pmrem.fromScene(envScene, 0.04).texture
  envScene.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    ;(m.material as THREE.Material | undefined)?.dispose()
  })
  photo?.dispose()
  pmrem.dispose()
  await tick()
  if (cancelled?.()) {
    envTex.dispose()
    return abort()
  }
  scene.environment = envTex
  scene.environmentIntensity = 1.0
  scene.add(new THREE.AmbientLight(0x8fa6d6, 0.08))
  const glintC = new THREE.PointLight(CYAN, 80, 0, 2)
  glintC.position.set(-8, 5, 8)
  const glintO = new THREE.PointLight(ORANGE, 60, 0, 2)
  glintO.position.set(9, -3, 7)
  scene.add(glintC, glintO)

  const fog = new THREE.Fog(0x070b14, 1, 2)
  scene.fog = fog
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T) => {
    disposables.push(o)
    return o
  }

  // ---- Red de nodos ------------------------------------------------------------------------------------------
  const net = new THREE.Group() // se desplaza a la derecha segun el aspecto
  const spin = new THREE.Group()
  net.add(spin)
  scene.add(net)

  const RX = 4.7
  const RY = 2.9
  const RZ = 3.4
  const N = 60
  const base: THREE.Vector3[] = []
  for (let guard = 0; base.length < N && guard < 12000; guard++) {
    const th = rnd() * Math.PI * 2
    const ph = Math.acos(2 * rnd() - 1)
    const r = Math.cbrt(rnd())
    const p = new THREE.Vector3(RX * r * Math.sin(ph) * Math.cos(th), RY * r * Math.sin(ph) * Math.sin(th), RZ * r * Math.cos(ph))
    if (base.every((q) => q.distanceTo(p) > 1.0)) base.push(p)
  }
  const n = base.length
  const cur = base.map((p) => p.clone())

  const order = base.map((_, i) => i).sort((a, b) => base[a].length() - base[b].length())
  const hubs: number[] = []
  for (const i of order) {
    if (hubs.length >= 5) break
    if (hubs.every((h) => base[h].distanceTo(base[i]) > 2.8)) hubs.push(i)
  }
  const isHub = new Set(hubs)
  const size = base.map((_, i) => (isHub.has(i) ? 0.4 + rnd() * 0.1 : rnd() < 0.28 ? 0.25 + rnd() * 0.1 : 0.1 + rnd() * 0.08))
  const phase = base.map(() => rnd() * Math.PI * 2)
  const freq = base.map(() => 0.2 + rnd() * 0.25)

  // Tres acabados PBR: cromo pulido (concentradores), acero y aluminio anodizado grafito.
  const mats = [
    track(new THREE.MeshPhysicalMaterial({ color: 0xcdd5e6, metalness: 1, roughness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.12 })),
    track(new THREE.MeshStandardMaterial({ color: 0x8793ab, metalness: 1, roughness: 0.3 })),
    track(new THREE.MeshPhysicalMaterial({ color: 0x39435c, metalness: 0.92, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.28 })),
  ]
  const groups: number[][] = [[], [], []]
  base.forEach((_, i) => groups[isHub.has(i) ? 0 : i % 2 === 0 ? 1 : 2].push(i))
  const sphereHi = track(new THREE.SphereGeometry(1, 40, 28)) // solo concentradores
  const sphereLo = track(new THREE.SphereGeometry(1, 22, 16))
  const nodeMeshes = groups.map((idx, g) => {
    const m = new THREE.InstancedMesh(g === 0 ? sphereHi : sphereLo, mats[g], Math.max(1, idx.length))
    m.count = idx.length
    spin.add(m)
    return m
  })

  // Conexiones: vecinos mas cercanos; mas gruesas en los concentradores.
  const edgeSet = new Set<string>()
  const edges: [number, number][] = []
  const link = (a: number, b: number) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`
    if (a === b || edgeSet.has(k)) return
    edgeSet.add(k)
    edges.push([a, b])
  }
  for (let i = 0; i < n; i++) {
    base
      .map((p, j) => ({ j, d: p.distanceTo(base[i]) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, isHub.has(i) ? 6 : 2)
      .forEach((o) => link(i, o.j))
  }
  const adj: number[][] = Array.from({ length: n }, () => [])
  edges.forEach(([a, b], e) => {
    adj[a].push(e)
    adj[b].push(e)
  })
  const wireGeo = track(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true))
  const wireMat = track(new THREE.MeshStandardMaterial({ color: 0x56637e, metalness: 1, roughness: 0.28, emissive: 0x1a7ea6, emissiveIntensity: 0.2 }))
  const wires = new THREE.InstancedMesh(wireGeo, wireMat, edges.length)
  spin.add(wires)

  // Pulsos de luz y brillo de concentradores (aditivos, pocos y tenues).
  const glowMat = (scale: number) =>
    track(
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
      }),
    )
  const pointsOf = (count: number, mat: THREE.ShaderMaterial, dynamic = false) => {
    const g = track(new THREE.BufferGeometry())
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
  const M = 28
  const pulseMat = glowMat(34)
  const pulseP = pointsOf(M * TAIL, pulseMat, true)
  spin.add(pulseP.obj)
  const pulses = Array.from({ length: M }, (_, i) => {
    const e = Math.floor(rnd() * edges.length)
    return { e, from: edges[e][0], t: rnd(), speed: 0.18 + rnd() * 0.26, color: i % 6 === 0 ? ORANGE : CYAN }
  })
  const tailK = [1, 0.5, 0.22]
  const tailS = [9, 6, 3.6]
  const tailOff = [0, 0.05, 0.1]
  pulses.forEach((p, i) => {
    for (let k = 0; k < TAIL; k++) {
      pulseP.size.setX(i * TAIL + k, tailS[k])
      pulseP.col.setXYZ(i * TAIL + k, p.color.r * tailK[k], p.color.g * tailK[k], p.color.b * tailK[k])
    }
  })
  const hubGlowMat = glowMat(34)
  const hubGlow = pointsOf(hubs.length, hubGlowMat, true)
  hubs.forEach((_, i) => {
    const c = i % 2 === 0 ? CYAN : ORANGE
    hubGlow.col.setXYZ(i, c.r * 0.34, c.g * 0.34, c.b * 0.34)
    hubGlow.size.setX(i, 14)
  })
  spin.add(hubGlow.obj)

  // ---- Animacion ---------------------------------------------------------------------------------------------
  const m4 = new THREE.Matrix4()
  const qEdge = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const sc = new THREE.Vector3()
  const pos = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const tmpA = new THREE.Vector3()
  const tmpB = new THREE.Vector3()

  let time = 0
  let inView = true
  let raf = 0
  let last = 0
  let lastRender = 0
  // Cuadros adaptativos: ~60 mientras el visitante mueve el puntero (el paralaje se nota) y ~30 en reposo (la deriva ambiental es muy lenta).
  // Con 1000/45 el filtro caia a un cuadro cada 2 ticks de pantalla; los topes llevan 10 % de margen para no perder el tick.
  const FRAME_ACTIVE = (1000 / 60) * 0.9
  const FRAME_IDLE = (1000 / 30) * 0.9
  let activeUntil = 0
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const onPointer = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
    activeUntil = performance.now() + 1800
  }
  if (!still) window.addEventListener("pointermove", onPointer, { passive: true })

  function updateNetwork(dt: number) {
    // Deriva organica: cada nodo oscila despacio alrededor de su posicion.
    for (let i = 0; i < n; i++) {
      const a = 0.08 + size[i] * 0.05
      cur[i].set(
        base[i].x + Math.sin(time * freq[i] + phase[i]) * a,
        base[i].y + Math.sin(time * freq[i] * 1.3 + phase[i] * 1.7) * a,
        base[i].z + Math.cos(time * freq[i] * 0.9 + phase[i]) * a,
      )
    }
    nodeMeshes.forEach((m, g) => {
      groups[g].forEach((i, k) => {
        m4.makeScale(size[i], size[i], size[i]).setPosition(cur[i])
        m.setMatrixAt(k, m4)
      })
      m.instanceMatrix.needsUpdate = true
    })
    hubs.forEach((h, k) => hubGlow.pos.setXYZ(k, cur[h].x, cur[h].y, cur[h].z))
    hubGlow.pos.needsUpdate = true
    edges.forEach(([a, b], e) => {
      dir.subVectors(cur[b], cur[a])
      const len = dir.length()
      qEdge.setFromUnitVectors(up, dir.normalize())
      pos.addVectors(cur[a], cur[b]).multiplyScalar(0.5)
      const th = isHub.has(a) || isHub.has(b) ? 0.02 : 0.012
      sc.set(th, len, th)
      m4.compose(pos, qEdge, sc)
      wires.setMatrixAt(e, m4)
    })
    wires.instanceMatrix.needsUpdate = true

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
        tmpA.copy(cur[p.from])
        tmpB.copy(cur[toIdx])
        tmpA.lerp(tmpB, Math.max(0, p.t - tailOff[k]))
        pulseP.pos.setXYZ(i * TAIL + k, tmpA.x, tmpA.y, tmpA.z)
      }
    }
    pulseP.pos.needsUpdate = true
  }

  function pose(dt: number) {
    time += dt
    const k = 1 - Math.exp(-dt * 2.14) // suavizado independiente de la tasa de cuadros (equivale a 0,035 por cuadro a 60 fps)
    pointer.x += (pointer.tx - pointer.x) * k
    pointer.y += (pointer.ty - pointer.y) * k
    spin.rotation.y = time * 0.045 + pointer.x * 0.16
    spin.rotation.x = 0.12 + Math.sin(time * 0.17) * 0.04 + pointer.y * 0.07
    updateNetwork(dt)
  }

  function resize() {
    const r = canvas.getBoundingClientRect()
    const width = Math.max(1, r.width)
    const height = Math.max(1, r.height)
    const px = Math.min(window.devicePixelRatio || 1, dprCap)
    renderer.setPixelRatio(px)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const tv = Math.tan((camera.fov * Math.PI) / 360)
    // Distancia para que el alto de la red ocupe ~68 % de la vista; la red se corre a la derecha, fuera del bloque de texto.
    const d = 7.2 / (2 * tv * 0.68)
    camera.position.set(0, 0.2, d)
    camera.lookAt(0, 0, 0)
    const halfW = d * tv * camera.aspect
    net.position.set(Math.min(halfW * 0.52, 10), 0, 0)
    camera.updateProjectionMatrix()
    pulseMat.uniforms.uPx.value = px
    hubGlowMat.uniforms.uPx.value = px
    // Los nodos del fondo se funden con la oscuridad de la foto (profundidad atmosferica).
    fog.near = d - 2
    fog.far = d + 9
    if (still) draw()
  }

  function draw() {
    renderer.render(scene, camera)
  }
  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    if (now - lastRender < (now < activeUntil ? FRAME_ACTIVE : FRAME_IDLE)) return
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
    disposables.forEach((d) => d.dispose())
    envTex.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }

  pose(0)
  resize()
  await tick()
  if (cancelled?.()) {
    dispose()
    return null
  }
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
