import { useEffect, useRef, useState } from 'react'

const W = 360
const H = 600
const LANES = 3
const HORIZON = 170
const CAM = 1.6 // focal distance factor
const ROAD_W = 300 // road width at z = 1

type Obj = { lane: number; z: number; kind: 'block' | 'wall' | 'gem'; hit?: boolean }

const project = (laneX: number, z: number) => {
  const s = CAM / (z + CAM)
  return { x: W / 2 + laneX * ROAD_W * s, y: HORIZON + (H - 40 - HORIZON) * s, s }
}
const laneX = (l: number) => (l - (LANES - 1) / 2) / LANES

export default function NeonRun() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'ready' | 'play' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [gems, setGems] = useState(0)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('neonrun-best') || 0) } catch { return 0 }
  })
  const g = useRef({ lane: 1, pos: 1, speed: 6, dist: 0, objs: [] as Obj[], next: 8, gems: 0, t: 0 })

  const start = () => {
    g.current = { lane: 1, pos: 1, speed: 6, dist: 0, objs: [], next: 8, gems: 0, t: 0 }
    setScore(0); setGems(0); setState('play')
  }
  const move = (dir: number) => {
    const s = g.current
    s.lane = Math.max(0, Math.min(LANES - 1, s.lane + dir))
  }
  const onPointer = (e: React.PointerEvent) => {
    if (state !== 'play') { start(); return }
    const r = e.currentTarget.getBoundingClientRect()
    move(e.clientX - r.left < r.width / 2 ? -1 : 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state !== 'play') { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); start() } return }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') move(-1)
      if (e.code === 'ArrowRight' || e.code === 'KeyD') move(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    let raf = 0, last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now
      const s = g.current
      s.t += dt
      if (state === 'play') {
        s.speed = Math.min(6 + s.dist / 60, 22)
        const dz = s.speed * dt
        s.dist += dz
        s.pos += (s.lane - s.pos) * Math.min(1, dt * 14)
        for (const o of s.objs) o.z -= dz
        s.next -= dz
        if (s.next <= 0) {
          const free = Math.floor(Math.random() * LANES)
          const wall = s.dist > 80 && Math.random() < 0.35
          for (let l = 0; l < LANES; l++) {
            if (l === free) { if (Math.random() < 0.5) s.objs.push({ lane: l, z: 40, kind: 'gem' }) }
            else if (wall || Math.random() < 0.55) s.objs.push({ lane: l, z: 40, kind: wall ? 'wall' : 'block' })
          }
          s.next = Math.max(5, 11 - s.dist / 80) + Math.random() * 3
        }
        for (const o of s.objs) {
          if (!o.hit && o.z < 0.6 && o.z > -0.4 && Math.abs(o.lane - s.pos) < 0.45) {
            o.hit = true
            if (o.kind === 'gem') { s.gems++; setGems(s.gems) }
            else {
              const final = Math.floor(s.dist)
              setState('over')
              setBest(b => {
                const nb = Math.max(b, final)
                try { localStorage.setItem('neonrun-best', String(nb)) } catch { /* ignore */ }
                return nb
              })
            }
          }
        }
        s.objs = s.objs.filter(o => o.z > -2 && !(o.kind === 'gem' && o.hit))
        setScore(Math.floor(s.dist))
      }

      // background
      const hue = (200 + s.dist * 0.8) % 360
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#05010f'); bg.addColorStop(1, `hsl(${hue} 60% 8%)`)
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + (i % 5) * 0.1})`
        ctx.fillRect((i * 97) % W, (i * 53) % HORIZON, 1.5, 1.5)
      }
      // road
      const n = project(-0.5, 40), n2 = project(0.5, 40)
      ctx.fillStyle = 'rgba(20,10,40,0.85)'
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(n2.x, n2.y); const b2 = project(0.5, -1.2), b1 = project(-0.5, -1.2); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b1.x, b1.y); ctx.fill()
      ctx.shadowBlur = 12
      const neon = `hsl(${hue} 100% 60%)`
      ctx.strokeStyle = neon; ctx.shadowColor = neon; ctx.lineWidth = 2
      for (let k = 0; k <= LANES; k++) {
        const lx = k / LANES - 0.5
        const a = project(lx, 40), b = project(lx, -1.2)
        ctx.globalAlpha = k === 0 || k === LANES ? 1 : 0.35
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      ctx.globalAlpha = 0.25
      for (let z = 2 - (s.dist % 2); z < 40; z += 2) {
        const a = project(-0.5, z), b = project(0.5, z)
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      ctx.globalAlpha = 1

      // objects, far to near
      const sorted = [...s.objs].sort((a, b) => b.z - a.z)
      for (const o of sorted) {
        if (o.z < -1.2) continue
        const p = project(laneX(o.lane), o.z)
        const w = (ROAD_W / LANES) * p.s * 0.8
        if (o.kind === 'gem') {
          const c = '#5ff7ff'; ctx.fillStyle = c; ctx.shadowColor = c
          const r = w * 0.22, cy = p.y - w * 0.4 + Math.sin(s.t * 5 + o.z) * 3 * p.s
          ctx.beginPath(); ctx.moveTo(p.x, cy - r); ctx.lineTo(p.x + r * 0.7, cy); ctx.lineTo(p.x, cy + r); ctx.lineTo(p.x - r * 0.7, cy); ctx.fill()
        } else {
          const c = o.kind === 'wall' ? '#ff3df2' : '#ff8a1f'
          const h = o.kind === 'wall' ? w * 0.9 : w * 0.55
          ctx.shadowColor = c; ctx.strokeStyle = c; ctx.lineWidth = 2
          ctx.fillStyle = o.kind === 'wall' ? 'rgba(255,61,242,0.25)' : 'rgba(255,138,31,0.25)'
          ctx.fillRect(p.x - w / 2, p.y - h, w, h); ctx.strokeRect(p.x - w / 2, p.y - h, w, h)
        }
      }
      // ball
      const bp = project(laneX(s.pos), 0)
      const r = 16
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 30
      const grad = ctx.createRadialGradient(bp.x - 5, bp.y - r - 5, 2, bp.x, bp.y - r, r)
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, neon)
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(bp.x, bp.y - r, r, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state])

  return (
    <section className="taproad">
      <div className="taproad-hud">
        <span>Táv: <strong>{score}</strong></span>
        <span>◆ <strong>{gems}</strong></span>
        <span>Rekord: <strong>{best}</strong></span>
      </div>
      <div className="taproad-wrap" onPointerDown={onPointer}>
        <canvas ref={canvasRef} width={W} height={H} />
        {state !== 'play' && (
          <div className="taproad-overlay">
            <h2>{state === 'over' ? 'Ütközés!' : 'Neonfutam'}</h2>
            <p>{state === 'over' ? `${score} egységet futottál, ${gems} kristállyal.` : 'Koppints a bal vagy jobb oldalra a sávváltáshoz. Kerüld ki az akadályokat, gyűjtsd a kristályokat!'}</p>
            <button type="button">{state === 'over' ? 'Újra' : 'Indulás'}</button>
          </div>
        )}
      </div>
      <p className="round-count">Koppintás bal/jobb oldalra · ← → vagy A / D</p>
    </section>
  )
}
