import * as THREE from "three"

// Escena 3D del hero: "del plano al producto".
// Un nucleo de luz atrae paneles de interfaz (wireframe) que se ensamblan en la ventana de un producto real.
// El DOM muestra el producto real encima; esta escena solo pone luz, profundidad y el ensamblado.
// Se carga de forma diferida (import dinamico) y solo si el dispositivo lo soporta (ver HeroStage).

export type SceneHandle = {
  setProgress: (p: number) => void
  setVisible: (v: boolean) => void
  resize: () => void
  dispose: () => void
}

type Opts = {
  canvas: HTMLCanvasElement
  /** Rectangulo (px, relativo al contenedor) donde termina el ensamblado: la ventana del producto. */
  getDock: () => { x: number; y: number; w: number; h: number } | null
  mobile: boolean
}

const BLUE = new THREE.Color("#2f7bff")
const CYAN = new THREE.Color("#5ee6ff")
const ORANGE = new THREE.Color("#ff7a1a")
const WARM = new THREE.Color("#fff3dc")

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = (t: number) => {
  t = clamp(t)
  return t * t * (3 - 2 * t)
}
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3)

// Piezas de la interfaz, en coordenadas normalizadas de la ventana (-0.5..0.5). x,y = centro; w,h = tamano.
const PIECES = [
  { x: 0, y: 0, w: 1, h: 1, fill: 0.035 }, // marco
  { x: 0, y: 0.455, w: 1, h: 0.09, fill: 0.09 }, // barra superior
  { x: -0.395, y: -0.045, w: 0.2, h: 0.82, fill: 0.06 }, // menu lateral
  { x: 0.1, y: 0.17, w: 0.76, h: 0.4, fill: 0.1 }, // portada
  { x: -0.12, y: -0.31, w: 0.34, h: 0.28, fill: 0.08 }, // tarjeta 1
  { x: 0.24, y: -0.31, w: 0.34, h: 0.28, fill: 0.08 }, // tarjeta 2
  { x: 0.1, y: -0.31, w: 0.0, h: 0.0, fill: 0 }, // reservado
].filter((p) => p.w > 0)

function rand(seed: number) {
  // Generador determinista simple para que la dispersion sea estable entre recargas.
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function createScene({ canvas, getDock, mobile }: Opts): SceneHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !mobile,
    powerPreference: "high-performance",
  })
  renderer.setClearColor(0x000000, 0)
  const dprCap = mobile ? 1 : 1.5
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  const CAM_Z = 12
  camera.position.set(0, 0, CAM_Z)

  const root = new THREE.Group()
  scene.add(root)

  // ---- Nucleo de luz --------------------------------------------------------------------------
  const core = new THREE.Group()
  root.add(core)

  const hot = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.MeshBasicMaterial({ color: WARM }),
  )
  core.add(hot)

  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uInner: { value: new THREE.Color("#ffb066") },
      uOuter: { value: new THREE.Color("#2f7bff") },
      uPower: { value: 2.0 },
      uAlpha: { value: 1 },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vV;
      uniform vec3 uInner; uniform vec3 uOuter; uniform float uPower; uniform float uAlpha;
      void main(){
        float f = pow(clamp(dot(-vN, vV), 0.0, 1.0), uPower);
        vec3 c = mix(uOuter, uInner, f);
        gl_FragColor = vec4(c, f * 0.95 * uAlpha);
      }`,
  })
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.7, 48, 48), haloMat)
  core.add(halo)
  const halo2 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 48, 48), haloMat.clone())
  ;(halo2.material as THREE.ShaderMaterial).uniforms.uPower.value = 1.4
  core.add(halo2)

  const rings: THREE.Mesh[] = []
  const ringDefs: [number, THREE.Color, [number, number, number]][] = [
    [1.35, CYAN, [1.2, 0.3, 0]],
    [1.75, ORANGE, [0.4, 1.1, 0.5]],
    [2.2, BLUE, [1.45, 0, 0.9]],
  ]
  for (const [r, color, rot] of ringDefs) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.016, 8, 180),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    m.rotation.set(rot[0], rot[1], rot[2])
    core.add(m)
    rings.push(m)
  }

  // ---- Particulas -----------------------------------------------------------------------------
  const COUNT = mobile ? 380 : 1100
  const pos = new Float32Array(COUNT * 3)
  const col = new Float32Array(COUNT * 3)
  const sizes = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    const r = 2.4 + Math.pow(rand(i + 1), 0.7) * 7.5
    const th = rand(i + 7) * Math.PI * 2
    const ph = Math.acos(2 * rand(i + 13) - 1)
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7
    pos[i * 3 + 2] = r * Math.cos(ph) - 2
    const k = rand(i + 29)
    const c = k > 0.9 ? ORANGE : k > 0.55 ? CYAN : BLUE
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
    sizes[i] = 0.6 + rand(i + 41) * 1.6
  }
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  pGeo.setAttribute("color", new THREE.BufferAttribute(col, 3))
  pGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1))
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: { uPx: { value: 1 }, uAlpha: { value: 1 } },
    vertexShader: `
      attribute float aSize; varying vec3 vC; uniform float uPx;
      void main(){
        vC = color;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = aSize * uPx * (30.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vC; uniform float uAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vC, a * 0.7 * uAlpha);
      }`,
  })
  const points = new THREE.Points(pGeo, pMat)
  root.add(points)

  // ---- Rejilla de plano (blueprint) -----------------------------------------------------------
  const gridPts: number[] = []
  const G = 26
  const STEP = 1.1
  for (let i = -G; i <= G; i++) {
    gridPts.push(-G * STEP, 0, i * STEP, G * STEP, 0, i * STEP)
    gridPts.push(i * STEP, 0, -G * STEP, i * STEP, 0, G * STEP)
  }
  const gGeo = new THREE.BufferGeometry()
  gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3))
  const gMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: BLUE }, uAlpha: { value: 0.5 } },
    vertexShader: `
      varying float vA;
      void main(){
        vA = 1.0 - clamp(length(position.xz) / 24.0, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      varying float vA; uniform vec3 uColor; uniform float uAlpha;
      void main(){ gl_FragColor = vec4(uColor, pow(vA, 1.2) * 0.8 * uAlpha); }`,
  })
  const grid = new THREE.LineSegments(gGeo, gMat)
  grid.position.set(0, -2.9, -3)
  scene.add(grid)

  // ---- Paneles de interfaz --------------------------------------------------------------------
  type Panel = {
    group: THREE.Group
    fill: THREE.Mesh
    edges: THREE.LineSegments
    from: THREE.Vector3
    fromRot: THREE.Euler
    spec: (typeof PIECES)[number]
    delay: number
  }
  const panels: Panel[] = []
  const unit = new THREE.PlaneGeometry(1, 1)
  const edgeGeo = new THREE.EdgesGeometry(unit)
  PIECES.forEach((spec, i) => {
    const group = new THREE.Group()
    const fill = new THREE.Mesh(
      unit,
      new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    )
    const edges = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: i === 0 ? CYAN : i % 2 ? BLUE : CYAN, transparent: true, opacity: 0 }),
    )
    group.add(fill, edges)
    root.add(group)
    const a = rand(i + 91) * Math.PI * 2
    const rr = 4 + rand(i + 51) * 3.5
    panels.push({
      group,
      fill,
      edges,
      spec,
      delay: i * 0.035,
      from: new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr * 0.65, -3 - rand(i + 3) * 5),
      fromRot: new THREE.Euler((rand(i + 5) - 0.5) * 2.4, (rand(i + 6) - 0.5) * 2.4, (rand(i + 8) - 0.5) * 1.6),
    })
  })

  // Lineas finas de contenido dentro del producto (texto/filas), visibles al ensamblar.
  const detailPts: number[] = []
  const addLine = (x1: number, y1: number, x2: number, y2: number) => detailPts.push(x1, y1, 0, x2, y2, 0)
  for (let k = 0; k < 4; k++) addLine(-0.28, 0.27 - k * 0.05, -0.28 + (k === 0 ? 0.34 : 0.26 - k * 0.03), 0.27 - k * 0.05)
  for (let k = 0; k < 5; k++) addLine(-0.47, 0.3 - k * 0.1, -0.35, 0.3 - k * 0.1)
  for (const cx of [-0.12, 0.24]) {
    addLine(cx - 0.14, -0.22, cx + 0.14, -0.22)
    addLine(cx - 0.14, -0.3, cx + 0.06, -0.3)
    addLine(cx - 0.14, -0.37, cx - 0.02, -0.37)
  }
  const dGeo = new THREE.BufferGeometry()
  dGeo.setAttribute("position", new THREE.Float32BufferAttribute(detailPts, 3))
  const dMat = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0 })
  const details = new THREE.LineSegments(dGeo, dMat)
  const detailGroup = new THREE.Group()
  detailGroup.add(details)
  root.add(detailGroup)

  // ---- Estado ---------------------------------------------------------------------------------
  let width = 1
  let height = 1
  let progress = 0
  let smoothP = 0
  let visible = true
  let raf = 0
  let last = performance.now()
  let time = 0
  let lastRender = 0
  const minFrame = 1000 / (mobile ? 30 : 50)
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

  const onPointer = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
  }
  if (!mobile) window.addEventListener("pointermove", onPointer, { passive: true })

  function worldPerPx() {
    return (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z) / height
  }

  function resize() {
    const r = canvas.getBoundingClientRect()
    width = Math.max(1, r.width)
    height = Math.max(1, r.height)
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    pMat.uniforms.uPx.value = dpr * (mobile ? 1.1 : 1)
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    if (!visible || document.hidden) {
      last = now
      return
    }
    if (now - lastRender < minFrame) return
    lastRender = now
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    time += dt
    smoothP += (progress - smoothP) * Math.min(1, dt * 7)
    const p = smoothP
    pointer.x += (pointer.tx - pointer.x) * 0.05
    pointer.y += (pointer.ty - pointer.y) * 0.05

    // Camara: parallax suave con el puntero + leve acercamiento al avanzar.
    camera.position.x = pointer.x * 0.35
    camera.position.y = -pointer.y * 0.22
    camera.position.z = CAM_Z - p * 1.2
    camera.lookAt(0, 0, 0)

    const wpp = worldPerPx()
    const viewW = width * wpp
    const viewH = height * wpp

    // Posicion del nucleo: al inicio a un lado (escritorio) o abajo (movil); luego al centro.
    const toCenter = smooth((p - 0.12) / 0.4)
    const sx = mobile ? 0 : viewW * 0.2
    const sy = mobile ? -viewH * 0.3 : 0
    core.position.set(sx * (1 - toCenter), sy * (1 - toCenter), 0)
    const fadeCore = smooth((p - 0.66) / 0.24)
    const pulse = 1 + Math.sin(time * 1.6) * 0.035
    const baseScale = (mobile ? 0.7 : 1) * (1 - toCenter * 0.28) * (1 - fadeCore * 0.85) * pulse
    core.scale.setScalar(Math.max(0.02, baseScale))
    haloMat.uniforms.uAlpha.value = 1 - fadeCore
    ;(halo2.material as THREE.ShaderMaterial).uniforms.uAlpha.value = 1 - fadeCore
    hot.visible = fadeCore < 0.98
    rings.forEach((m, i) => {
      m.rotation.x += dt * (0.18 + i * 0.07)
      m.rotation.y += dt * (0.12 - i * 0.04)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - fadeCore)
    })

    points.rotation.y = time * 0.04 + p * 0.9
    points.rotation.x = Math.sin(time * 0.1) * 0.06
    points.position.x = core.position.x * 0.5
    pMat.uniforms.uAlpha.value = 1 - fadeCore * 0.75
    const spread = 1 + p * 0.5
    points.scale.setScalar(spread)

    grid.position.y = -2.9 - p * 0.8
    gMat.uniforms.uAlpha.value = 0.5 + smooth((p - 0.1) / 0.3) * 0.6 - fadeCore * 0.4

    // Ensamblado de los paneles sobre la ventana del producto.
    const dock = getDock()
    const assemble = (i: number) => easeOut((p - 0.16 - panels[i].delay) / 0.42)
    const dockCx = dock ? (dock.x + dock.w / 2 - width / 2) * wpp : 0
    const dockCy = dock ? -(dock.y + dock.h / 2 - height / 2) * wpp : 0
    const dockW = dock ? dock.w * wpp : viewW * 0.6
    const dockH = dock ? dock.h * wpp : viewH * 0.5
    const edgeFade = 1 - smooth((p - 0.8) / 0.14)
    panels.forEach((pl, i) => {
      const t = assemble(i)
      const tx = dockCx + pl.spec.x * dockW
      const ty = dockCy + pl.spec.y * dockH
      pl.group.position.set(
        pl.from.x + (tx - pl.from.x) * t,
        pl.from.y + (ty - pl.from.y) * t,
        pl.from.z * (1 - t),
      )
      pl.group.rotation.set(pl.fromRot.x * (1 - t), pl.fromRot.y * (1 - t), pl.fromRot.z * (1 - t))
      const s = 0.55 + 0.45 * t
      pl.group.scale.set(pl.spec.w * dockW * s, pl.spec.h * dockH * s, 1)
      ;(pl.edges.material as THREE.LineBasicMaterial).opacity = clamp(t * 1.4) * 0.9 * edgeFade
      ;(pl.fill.material as THREE.MeshBasicMaterial).opacity = pl.spec.fill * t * (1 - smooth((p - 0.7) / 0.16))
    })
    const detailT = smooth((p - 0.52) / 0.2)
    detailGroup.position.set(dockCx, dockCy, 0.01)
    detailGroup.scale.set(dockW, dockH, 1)
    dMat.opacity = detailT * 0.8 * edgeFade

    renderer.render(scene, camera)
  }

  resize()
  raf = requestAnimationFrame(frame)

  return {
    setProgress: (p) => {
      progress = clamp(p)
    },
    setVisible: (v) => {
      visible = v
    },
    resize,
    dispose: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onPointer)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      })
      renderer.dispose()
    },
  }
}
