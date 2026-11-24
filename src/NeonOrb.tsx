import { useEffect, useRef, useState } from 'react'

const W = 400
const H = 600
const F = W * 0.9
const HORIZON = H * 0.36
const CAM_H = 1.7
const CAM_BACK = 3
const FAR = 70
const LANE_X = 0.6
const TRACK_OFF = 1.7
const CHALLENGE_GOAL = 800

type ModeId = 'endless' | 'gravity' | 'dual' | 'blackout' | 'rotate' | 'invisible' | 'final'
type Mods = { gravity: boolean; dual: boolean; blackout: boolean; rotate: boolean; invisible: boolean }

const MODES: { id: ModeId; name: string; desc: string; mods: Mods }[] = [
  { id: 'endless', name: 'Végtelenített', desc: 'Élj túl minél tovább, gyűjts drágaköveket!', mods: { gravity: false, dual: false, blackout: false, rotate: false, invisible: false } },
  { id: 'gravity', name: 'Gravitációváltás', desc: 'Tartsd nyomva: a gömb felemelkedik és átrepül az akadályok felett.', mods: { gravity: true, dual: false, blackout: false, rotate: false, invisible: false } },
  { id: 'dual', name: 'Dupla sáv', desc: 'Két gömb, két pálya – bármelyik hibája kiesés.', mods: { gravity: false, dual: true, blackout: false, rotate: false, invisible: false } },
  { id: 'blackout', name: 'Áramszünet', desc: 'Csak egy apró fénykör látszik a sötétben.', mods: { gravity: false, dual: false, blackout: true, rotate: false, invisible: false } },
  { id: 'rotate', name: 'Forgó kamera', desc: 'A pálya forog, és fejjel lefelé is átfordul.', mods: { gravity: false, dual: false, blackout: false, rotate: true, invisible: false } },
  { id: 'invisible', name: 'Láthatatlan gömb', desc: 'Nem látod a gömböt – érezd a helyzetét!', mods: { gravity: false, dual: false, blackout: false, rotate: false, invisible: true } },
  { id: 'final', name: 'Végső kihívás', desc: 'Minden nehezítés egyszerre.', mods: { gravity: true, dual: true, blackout: true, rotate: true, invisible: true } },
]
const CHALLENGES: ModeId[] = ['gravity', 'dual', 'blackout', 'rotate', 'invisible']

const SKINS = Array.from({ length: 50 }, (_, i) => {
  const hue = (i * 137.5) % 360
  return {
    name: i === 0 ? 'Alap' : `Gömb #${i + 1}`,
    core: `hsl(${hue},100%,${i % 3 === 2 ? 90 : 70}%)`,
    glow: `hsl(${(hue + (i % 5) * 25) % 360},100%,55%)`,
    ring: i % 4 === 3,
    price: i === 0 ? 0 : 20 + i * 10,
  }
})
const THEMES = Array.from({ length: 25 }, (_, i) => {
  const hue = (200 + i * 53) % 360
  return {
    name: i === 0 ? 'Neon kék' : `Téma #${i + 1}`,
    bg1: `hsl(${hue},60%,${6 + (i % 3) * 3}%)`,
    bg2: `hsl(${(hue + 40) % 360},70%,${18 + (i % 4) * 4}%)`,
    track: `hsl(${hue},40%,${14 + (i % 2) * 6}%)`,
    line: `hsl(${(hue + 160) % 360},100%,60%)`,
    obst: `hsl(${(hue + 180 + i * 7) % 360},90%,55%)`,
    price: i === 0 ? 0 : 60 + i * 25,
  }
})
const RANK_NAMES = ['Újonc', 'Gurító', 'Száguldó', 'Fényfutó', 'Neonlovas', 'Pályamester', 'Csillag', 'Üstökös', 'Nova', 'Legenda']
const RANKS = Array.from({ length: 30 }, (_, i) => ({
  name: `${RANK_NAMES[Math.floor(i / 3)]} ${['I', 'II', 'III'][i % 3]}`,
  xp: Math.round(40 * i * i + 60 * i),
}))

type Mission = { id: string; text: string; kind: 'gems' | 'dist' | 'runs' | 'challenge'; goal: number; reward: number; xp: number }
function dailyMissions(day: string): Mission[] {
  let s = [...day].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  const g = 10 + Math.floor(r() * 4) * 10
  const d = 300 + Math.floor(r() * 5) * 150
  const n = 3 + Math.floor(r() * 3)
  return [
    { id: 'gems', text: `Gyűjts ${g} drágakövet`, kind: 'gems', goal: g, reward: 30, xp: 80 },
    { id: 'dist', text: `Fuss ${d} métert egy futamban`, kind: 'dist', goal: d, reward: 40, xp: 100 },
    { id: 'runs', text: `Játssz ${n} futamot`, kind: 'runs', goal: n, reward: 25, xp: 60 },
    { id: 'chal', text: 'Játssz egy speciális kihívást', kind: 'challenge', goal: 1, reward: 35, xp: 90 },
  ]
}

type Save = {
  gems: number; best: number; xp: number; done: ModeId[]; skins: number[]; themes: number[]; skin: number; theme: number
  day: string; prog: Record<string, number>; claimed: string[]; dailyClaimed: string
}
const today = () => new Date().toISOString().slice(0, 10)
const KEY = 'neonorb-save'
function loadSave(): Save {
  const base: Save = { gems: 0, best: 0, xp: 0, done: [], skins: [0], themes: [0], skin: 0, theme: 0, day: today(), prog: {}, claimed: [], dailyClaimed: '' }
  let s = base
  try { s = { ...base, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { /* ignore */ }
  if (s.day !== today()) s = { ...s, day: today(), prog: {}, claimed: [] }
  return s
}
function persist(s: Save) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }

type Obst = { z: number; track: number; kind: 'spike' | 'block' | 'mover' | 'wall'; lane: number; x: number; h: number; num: number; phase: number; hit?: boolean }
type Gem = { z: number; track: number; x: number; y: number; taken: boolean }
type Orb = { lane: number; x: number; y: number; vy: number }

function newGame(mods: Mods) {
  return {
    mods, t: 0, dist: 0, speed: 9, nextZ: 18, obst: [] as Obst[], gems: [] as Gem[],
    orbs: (mods.dual ? [0, 1] : [0]).map(() => ({ lane: 0, x: -LANE_X, y: 0, vy: 0 }) as Orb),
    holding: false, holdStart: 0, collected: 0, dead: false, shake: 0,
  }
}
type Game = ReturnType<typeof newGame>

function trackCenter(g: Game, tr: number) { return g.mods.dual ? (tr === 0 ? -TRACK_OFF : TRACK_OFF) : 0 }
function laneX(g: Game, tr: number, lane: number) {
  const side = lane === 0 ? -1 : 1
  return trackCenter(g, tr) + side * LANE_X * (g.mods.dual && tr === 1 ? -1 : 1)
}

function spawnRow(g: Game) {
  const z = g.nextZ
  const tracks = g.mods.dual ? 2 : 1
  for (let tr = 0; tr < tracks; tr++) {
    const r = Math.random()
    const lane = Math.random() < 0.5 ? 0 : 1
    const free = 1 - lane
    if (g.mods.gravity && r < 0.25) {
      for (const l of [0, 1]) g.obst.push({ z, track: tr, kind: 'wall', lane: l, x: laneX(g, tr, l), h: 0.7, num: 0, phase: 0 })
      g.gems.push({ z, track: tr, x: laneX(g, tr, lane), y: 1.6, taken: false })
      continue
    }
    const kind: Obst['kind'] = r < 0.45 ? 'spike' : r < 0.8 ? 'block' : 'mover'
    g.obst.push({ z, track: tr, kind, lane, x: laneX(g, tr, lane), h: kind === 'spike' ? 0.6 : 0.8, num: 1 + Math.floor(Math.random() * 9), phase: Math.random() * 6 })
    if (Math.random() < 0.45) g.gems.push({ z: z + (Math.random() < 0.5 ? 0 : 3), track: tr, x: laneX(g, tr, free), y: 0.35, taken: false })
  }
  g.nextZ += Math.max(5.5, 10 - g.t * 0.05) + Math.random() * 3
}

function step(g: Game, dt: number) {
  g.t += dt
  g.speed = Math.min(30, 9 + g.t * 0.28)
  const dz = g.speed * dt
  g.dist += dz
  while (g.nextZ < g.dist + FAR) spawnRow(g)
  const lift = g.mods.gravity && g.holding && performance.now() - g.holdStart > 120
  g.orbs.forEach((o, tr) => {
    o.x += (laneX(g, tr, o.lane) - o.x) * Math.min(1, dt * 16)
    if (g.mods.gravity) {
      o.vy += (lift ? 30 : -34) * dt
      o.vy = Math.max(-12, Math.min(9, o.vy))
      o.y += o.vy * dt
      if (o.y < 0) { o.y = 0; o.vy = 0 }
      if (o.y > 1.7) { o.y = 1.7; o.vy = 0 }
    }
  })
  for (const ob of g.obst) {
    if (ob.kind === 'mover') {
      const c = trackCenter(g, ob.track)
      ob.x = c + Math.sin(g.t * 2.2 + ob.phase) * LANE_X
    }
    const rel = ob.z - g.dist
    if (rel < 0.5 && rel > -0.5) {
      const o = g.orbs[ob.track]
      if (Math.abs(o.x - ob.x) < 0.55 && o.y < ob.h) { g.dead = true; ob.hit = true }
    }
  }
  for (const gm of g.gems) {
    if (gm.taken) continue
    const rel = gm.z - g.dist
    const o = g.orbs[gm.track]
    if (Math.abs(rel) < 0.6 && Math.abs(o.x - gm.x) < 0.5 && Math.abs((o.y + 0.3) - gm.y) < 0.7) { gm.taken = true; g.collected++ }
  }
  g.obst = g.obst.filter((o) => o.z - g.dist > -CAM_BACK)
  g.gems = g.gems.filter((o) => o.z - g.dist > -CAM_BACK && !o.taken)
}

function proj(x: number, y: number, z: number) {
  const zc = Math.max(0.1, z + CAM_BACK)
  const s = F / zc
  return { x: W / 2 + x * s, y: HORIZON + (CAM_H - y) * s, s }
}

function draw(ctx: CanvasRenderingContext2D, g: Game, skinI: number, themeI: number) {
  const th = THEMES[themeI], sk = SKINS[skinI]
  ctx.save()
  ctx.fillStyle = th.bg1
  ctx.fillRect(0, 0, W, H)
  if (g.mods.rotate) {
    const a = Math.sin(g.t * 0.35) * 0.6 + (Math.sin(g.t * 0.13) > 0.55 ? Math.PI : 0)
    ctx.translate(W / 2, H / 2); ctx.rotate(a); ctx.translate(-W / 2, -H / 2)
  }
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake)
  const grad = ctx.createLinearGradient(0, -H, 0, HORIZON + 40)
  grad.addColorStop(0, th.bg1); grad.addColorStop(1, th.bg2)
  ctx.fillStyle = grad
  ctx.fillRect(-W, -H, W * 3, H * 3)
  // stars
  ctx.fillStyle = 'rgba(255,255,255,.6)'
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 97 + 13) % W, (i * i * 31 + i * 7) % HORIZON, 1.5, 1.5)

  const tracks = g.mods.dual ? 2 : 1
  for (let tr = 0; tr < tracks; tr++) {
    const c = trackCenter(g, tr)
    const hw = LANE_X * 2
    const a = proj(c - hw, 0, -CAM_BACK + 0.2), b = proj(c + hw, 0, -CAM_BACK + 0.2)
    const cf = proj(c + hw, 0, FAR), d = proj(c - hw, 0, FAR)
    ctx.fillStyle = th.track
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(cf.x, cf.y); ctx.lineTo(d.x, d.y); ctx.fill()
    // under-glow edge
    const a2 = proj(c - hw, -0.35, -CAM_BACK + 0.2), b2 = proj(c + hw, -0.35, -CAM_BACK + 0.2)
    ctx.fillStyle = 'rgba(0,0,0,.35)'
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(a2.x, a2.y); ctx.fill()
    ctx.strokeStyle = th.line; ctx.lineWidth = 2; ctx.shadowColor = th.line; ctx.shadowBlur = 10
    for (const ex of [c - hw, c + hw]) {
      const p1 = proj(ex, 0, -CAM_BACK + 0.2), p2 = proj(ex, 0, FAR)
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 0.5
    const off = g.dist % 4
    for (let z = -off; z < FAR; z += 4) {
      const p1 = proj(c, 0, z), p2 = proj(c, 0, z + 1.6)
      ctx.lineWidth = Math.max(1, p1.s * 0.04)
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  type Drawable = { z: number; fn: () => void }
  const list: Drawable[] = []
  for (const ob of g.obst) {
    const rel = ob.z - g.dist
    if (rel > FAR) continue
    list.push({ z: rel, fn: () => {
      const fog = Math.max(0, Math.min(1, 1 - rel / FAR))
      ctx.globalAlpha = fog
      const hw = 0.42, d = 0.4
      const col = ob.hit ? '#fff' : ob.kind === 'mover' ? '#ff3df0' : ob.kind === 'wall' ? '#ff9a1f' : th.obst
      if (ob.kind === 'spike') {
        for (const sx of [-0.25, 0.25]) {
          const l = proj(ob.x + sx - 0.2, 0, rel), r = proj(ob.x + sx + 0.2, 0, rel), t = proj(ob.x + sx, ob.h, rel + 0.1)
          ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12
          ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.lineTo(t.x, t.y); ctx.fill()
        }
        ctx.shadowBlur = 0
      } else {
        const fl = proj(ob.x - hw, 0, rel - d), fr = proj(ob.x + hw, 0, rel - d)
        const tl = proj(ob.x - hw, ob.h, rel - d), tr = proj(ob.x + hw, ob.h, rel - d)
        const bl = proj(ob.x - hw, ob.h, rel + d), br = proj(ob.x + hw, ob.h, rel + d)
        ctx.fillStyle = 'rgba(255,255,255,.25)'
        ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.fill()
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 14
        ctx.fillRect(tl.x, tl.y, fr.x - fl.x, fl.y - tl.y)
        ctx.shadowBlur = 0
        if (ob.kind === 'block' && fr.x - fl.x > 12) {
          ctx.fillStyle = '#0b0b1a'
          ctx.font = `bold ${Math.round((fl.y - tl.y) * 0.6)}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(String(ob.num), (fl.x + fr.x) / 2, (tl.y + fl.y) / 2)
        }
      }
      ctx.globalAlpha = 1
    } })
  }
  for (const gm of g.gems) {
    const rel = gm.z - g.dist
    if (rel > FAR) continue
    list.push({ z: rel, fn: () => {
      const p = proj(gm.x, gm.y + Math.sin(g.t * 4 + gm.z) * 0.08, rel)
      const r = p.s * 0.16
      ctx.fillStyle = '#5ff7ff'; ctx.shadowColor = '#5ff7ff'; ctx.shadowBlur = 14
      ctx.beginPath(); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r * 0.7, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r * 0.7, p.y); ctx.fill()
      ctx.shadowBlur = 0
    } })
  }
  if (!g.mods.invisible || g.dead) {
    g.orbs.forEach((o) => list.push({ z: 0, fn: () => {
      const sh = proj(o.x, 0, 0)
      ctx.fillStyle = 'rgba(0,0,0,.4)'
      ctx.beginPath(); ctx.ellipse(sh.x, sh.y, sh.s * 0.3, sh.s * 0.08, 0, 0, Math.PI * 2); ctx.fill()
      const p = proj(o.x, o.y + 0.3, 0)
      const r = p.s * 0.3
      const rg = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r)
      rg.addColorStop(0, '#fff'); rg.addColorStop(0.4, sk.core); rg.addColorStop(1, sk.glow)
      ctx.fillStyle = rg; ctx.shadowColor = sk.glow; ctx.shadowBlur = 30
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      if (sk.ring) { ctx.strokeStyle = sk.core; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.5, r * 0.4, 0.2, 0, Math.PI * 2); ctx.stroke() }
    } }))
  }
  list.sort((a, b) => b.z - a.z).forEach((d) => d.fn())

  if (g.mods.blackout) {
    const o = g.orbs[0], p = proj(g.mods.dual ? 0 : o.x, 0.3, 0)
    const rg = ctx.createRadialGradient(p.x, p.y - 60, 40, p.x, p.y - 60, g.mods.dual ? 260 : 170)
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.97)')
    ctx.fillStyle = rg; ctx.fillRect(-W, -H, W * 3, H * 3)
  }
  ctx.restore()
}

type Screen = 'menu' | 'play' | 'over' | 'shop' | 'missions'

export default function NeonOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [save, setSave] = useState<Save>(loadSave)
  const saveRef = useRef(save)
  const [screen, setScreen] = useState<Screen>('menu')
  const [mode, setMode] = useState<ModeId>('endless')
  const [hud, setHud] = useState({ dist: 0, gems: 0 })
  const [result, setResult] = useState({ dist: 0, gems: 0, record: false, cleared: false })
  const [shopTab, setShopTab] = useState<'skins' | 'themes'>('skins')
  const game = useRef<Game>(newGame(MODES[0].mods))

  const update = (fn: (s: Save) => Save) => { const n = fn(saveRef.current); saveRef.current = n; persist(n); setSave(n) }
  const missions = dailyMissions(save.day)
  const rankIdx = RANKS.reduce((a, r, i) => (save.xp >= r.xp ? i : a), 0)
  const unlockedFinal = CHALLENGES.every((c) => save.done.includes(c))

  const start = (m: ModeId) => {
    setMode(m)
    game.current = newGame(MODES.find((x) => x.id === m)!.mods)
    setHud({ dist: 0, gems: 0 })
    setScreen('play')
  }

  const finish = () => {
    const g = game.current
    const dist = Math.floor(g.dist)
    const isChal = mode !== 'endless'
    const cleared = isChal && dist >= CHALLENGE_GOAL
    const record = mode === 'endless' && dist > saveRef.current.best
    update((s) => {
      const p = { ...s.prog }
      p.gems = (p.gems || 0) + g.collected
      p.dist = Math.max(p.dist || 0, dist)
      p.runs = (p.runs || 0) + 1
      if (isChal) p.challenge = 1
      return {
        ...s, prog: p, gems: s.gems + g.collected, xp: s.xp + Math.floor(dist / 20),
        best: record ? dist : s.best,
        done: cleared && !s.done.includes(mode) ? [...s.done, mode] : s.done,
      }
    })
    setResult({ dist, gems: g.collected, record, cleared })
    setScreen('over')
  }

  useEffect(() => {
    if (screen !== 'play') return
    const ctx = canvasRef.current!.getContext('2d')!
    let raf = 0, last = performance.now(), ended = false, hudT = 0
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now
      const g = game.current
      if (!g.dead) {
        step(g, dt)
        if (mode !== 'endless' && g.dist >= CHALLENGE_GOAL) g.dead = true
      } else {
        g.shake = Math.max(0, g.shake * 0.9)
        if (!ended) { ended = true; g.shake = 14; window.setTimeout(finish, 700) }
      }
      draw(ctx, g, saveRef.current.skin, saveRef.current.theme)
      hudT += dt
      if (hudT > 0.1) { hudT = 0; setHud({ dist: Math.floor(g.dist), gems: g.collected }) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const down = () => { const g = game.current; if (g.holding) return; g.holding = true; g.holdStart = performance.now() }
    const up = () => {
      const g = game.current
      if (!g.holding) return
      g.holding = false
      const short = performance.now() - g.holdStart < 180
      if (!g.dead && (!g.mods.gravity || short)) g.orbs.forEach((o) => { o.lane = 1 - o.lane })
    }
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code.startsWith('Arrow')) { e.preventDefault(); if (!e.repeat) down() } }
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code.startsWith('Arrow')) up() }
    const cv = canvasRef.current!
    cv.addEventListener('pointerdown', down); window.addEventListener('pointerup', up)
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => {
      cancelAnimationFrame(raf)
      cv.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, mode])

  // idle preview on menu
  useEffect(() => {
    if (screen === 'play' || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    const g = newGame(MODES[0].mods)
    g.obst = []
    draw(ctx, g, save.skin, save.theme)
  }, [screen, save.skin, save.theme])

  const buy = (kind: 'skins' | 'themes', i: number) => {
    const item = kind === 'skins' ? SKINS[i] : THEMES[i]
    const owned = save[kind].includes(i)
    if (owned) return update((s) => ({ ...s, [kind === 'skins' ? 'skin' : 'theme']: i }))
    if (save.gems < item.price) return
    update((s) => ({ ...s, gems: s.gems - item.price, [kind]: [...s[kind], i], [kind === 'skins' ? 'skin' : 'theme']: i }))
  }

  const claim = (m: Mission) => update((s) => ({ ...s, gems: s.gems + m.reward, xp: s.xp + m.xp, claimed: [...s.claimed, m.id] }))
  const dailyAvailable = save.dailyClaimed !== save.day

  return (
    <section className="neonorb">
      <div className="no-hud">
        <span>💎 {save.gems}</span>
        <span>🏅 {RANKS[rankIdx].name}</span>
        <span>Rekord: {save.best} m</span>
      </div>
      <div className="no-wrap">
        <canvas ref={canvasRef} width={W} height={H} />
        {screen === 'play' && (
          <div className="no-live">
            <span>{hud.dist} m{mode !== 'endless' && ` / ${CHALLENGE_GOAL}`}</span>
            <span>💎 {hud.gems}</span>
          </div>
        )}
        {screen === 'menu' && (
          <div className="no-overlay">
            <h2>Neon Gömb</h2>
            <button className="no-primary" onClick={() => start('endless')}>▶ Végtelenített mód</button>
            <p className="no-sub">Speciális kihívások (cél: {CHALLENGE_GOAL} m)</p>
            <div className="no-modes">
              {MODES.slice(1).map((m) => {
                const locked = m.id === 'final' && !unlockedFinal
                return (
                  <button key={m.id} disabled={locked} title={m.desc} onClick={() => start(m.id)} className={save.done.includes(m.id) ? 'done' : ''}>
                    {locked ? '🔒 ' : save.done.includes(m.id) ? '✔ ' : ''}{m.name}
                  </button>
                )
              })}
            </div>
            <div className="no-row">
              <button onClick={() => setScreen('shop')}>🛒 Bolt</button>
              <button onClick={() => setScreen('missions')}>📋 Küldetések</button>
            </div>
          </div>
        )}
        {screen === 'over' && (
          <div className="no-overlay">
            <h2>{result.cleared ? 'Teljesítve!' : 'Kiestél!'}</h2>
            <p>{MODES.find((m) => m.id === mode)!.name}</p>
            <p className="no-big">{result.dist} m</p>
            <p>💎 +{result.gems}{result.record && ' · Új rekord! 🎉'}</p>
            <div className="no-row">
              <button className="no-primary" onClick={() => start(mode)}>Újra</button>
              <button onClick={() => setScreen('menu')}>Menü</button>
            </div>
          </div>
        )}
        {screen === 'shop' && (
          <div className="no-overlay no-scroll">
            <h2>Bolt</h2>
            <div className="no-row">
              <button className={shopTab === 'skins' ? 'no-primary' : ''} onClick={() => setShopTab('skins')}>Gömbök (50)</button>
              <button className={shopTab === 'themes' ? 'no-primary' : ''} onClick={() => setShopTab('themes')}>Témák (25)</button>
            </div>
            <div className="no-grid">
              {(shopTab === 'skins' ? SKINS : THEMES).map((it, i) => {
                const owned = save[shopTab].includes(i)
                const sel = (shopTab === 'skins' ? save.skin : save.theme) === i
                const swatch = 'core' in it
                  ? { background: `radial-gradient(circle at 35% 35%, #fff, ${it.core} 40%, ${it.glow})`, borderRadius: '50%' }
                  : { background: `linear-gradient(${it.bg2}, ${it.track} 60%, ${it.line})` }
                return (
                  <button key={i} className={`no-item ${sel ? 'sel' : ''}`} onClick={() => buy(shopTab, i)} disabled={!owned && save.gems < it.price}>
                    <span className="no-swatch" style={swatch} />
                    <small>{owned ? (sel ? 'Kiválasztva' : 'Saját') : `💎 ${it.price}`}</small>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setScreen('menu')}>Vissza</button>
          </div>
        )}
        {screen === 'missions' && (
          <div className="no-overlay no-scroll">
            <h2>Napi küldetések</h2>
            <button className="no-primary" disabled={!dailyAvailable} onClick={() => update((s) => ({ ...s, gems: s.gems + 20, xp: s.xp + 50, dailyClaimed: s.day }))}>
              {dailyAvailable ? '🎁 Napi jutalom: 💎20 + 50 XP' : 'Napi jutalom átvéve'}
            </button>
            {missions.map((m) => {
              const p = Math.min(m.goal, save.prog[m.kind] || 0)
              const claimed = save.claimed.includes(m.id)
              return (
                <div key={m.id} className="no-mission">
                  <div><b>{m.text}</b><small>{p}/{m.goal} · 💎{m.reward} · {m.xp} XP</small></div>
                  <button disabled={claimed || p < m.goal} onClick={() => claim(m)}>{claimed ? '✔' : 'Átvesz'}</button>
                </div>
              )
            })}
            <p className="no-sub">Rang: {RANKS[rankIdx].name} ({rankIdx + 1}/30) · {save.xp} XP
              {rankIdx < 29 && ` · következő: ${RANKS[rankIdx + 1].xp} XP`}</p>
            <button onClick={() => setScreen('menu')}>Vissza</button>
          </div>
        )}
      </div>
      <p className="round-count">
        Koppintás / Szóköz = sávváltás{(mode === 'gravity' || mode === 'final') && screen === 'play' ? ' · Nyomva tartás = emelkedés' : ''}
      </p>
    </section>
  )
}
