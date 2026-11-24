import { useEffect, useRef, useState } from 'react'

const W = 360
const H = 560
const LANE = 56
const VISIBLE = Math.ceil(H / LANE) + 2
const COLORS = ['#e4572e', '#29335c', '#f3a712', '#669bbc', '#8e44ad', '#2a9d8f']

type Lane = { kind: 'grass' | 'road'; speed: number; cars: { x: number; w: number; c: string }[] }

function makeLane(i: number): Lane {
  if (i < 2 || Math.random() < 0.3) return { kind: 'grass', speed: 0, cars: [] }
  const diff = Math.min(1 + i / 40, 3)
  const dir = Math.random() < 0.5 ? -1 : 1
  const speed = dir * (50 + Math.random() * 70) * diff
  const cars: Lane['cars'] = []
  let x = Math.random() * 120
  while (x < W + 200) {
    const w = 46 + Math.random() * 40
    cars.push({ x, w, c: COLORS[Math.floor(Math.random() * COLORS.length)] })
    x += w + 110 + Math.random() * 140
  }
  return { kind: 'road', speed, cars }
}

export default function TapRoad() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('taproad2-best') || 0) } catch { return 0 }
  })
  const [state, setState] = useState<'ready' | 'play' | 'over'>('ready')
  const game = useRef({ lanes: Array.from({ length: VISIBLE + 4 }, (_, i) => makeLane(i)), row: 0, cam: 0, hop: 0, col: W / 2 })

  const reset = () => {
    const g = game.current
    g.lanes = Array.from({ length: VISIBLE + 4 }, (_, i) => makeLane(i))
    g.row = 0; g.cam = 0; g.hop = 0; g.col = W / 2
    setScore(0)
  }

  const tap = () => {
    if (state !== 'play') { reset(); setState('play'); return }
    const g = game.current
    g.row += 1; g.hop = 1
    while (g.lanes.length < g.row + VISIBLE + 4) g.lanes.push(makeLane(g.lanes.length))
    setScore(s => Math.max(s, g.row))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); tap() }
      const g = game.current
      if (state === 'play' && e.code === 'ArrowLeft') g.col = Math.max(24, g.col - LANE)
      if (state === 'play' && e.code === 'ArrowRight') g.col = Math.min(W - 24, g.col + LANE)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    let raf = 0, last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05); last = t
      const g = game.current
      g.cam += (g.row - g.cam) * Math.min(1, dt * 10)
      g.hop = Math.max(0, g.hop - dt * 6)
      const baseY = H - LANE * 2
      const start = Math.max(0, Math.floor(g.cam) - 2)
      for (let i = start; i < start + VISIBLE && i < g.lanes.length; i++) {
        const lane = g.lanes[i]
        const y = baseY - (i - g.cam) * LANE
        ctx.fillStyle = lane.kind === 'grass' ? (i % 2 ? '#8cc152' : '#a0d468') : '#434a54'
        ctx.fillRect(0, y, W, LANE)
        if (lane.kind === 'road') {
          ctx.fillStyle = '#ffffff55'
          for (let x = 10; x < W; x += 40) ctx.fillRect(x, y + LANE / 2 - 1, 20, 2)
          for (const car of lane.cars) {
            if (state === 'play') {
              car.x += lane.speed * dt
              const span = W + 260
              if (lane.speed > 0 && car.x > W + 100) car.x -= span
              if (lane.speed < 0 && car.x + car.w < -100) car.x += span
            }
            ctx.fillStyle = car.c
            ctx.beginPath(); ctx.roundRect(car.x, y + 9, car.w, LANE - 18, 8); ctx.fill()
            ctx.fillStyle = '#ffffffaa'
            const wx = lane.speed > 0 ? car.x + car.w - 14 : car.x + 4
            ctx.fillRect(wx, y + 14, 10, LANE - 28)
          }
        }
      }
      // player
      const py = baseY - (g.row - g.cam) * LANE + LANE / 2 - Math.sin(g.hop * Math.PI) * 12
      ctx.fillStyle = '#00000033'
      ctx.beginPath(); ctx.ellipse(g.col, baseY - (g.row - g.cam) * LANE + LANE - 10, 14, 5, 0, 0, 7); ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.roundRect(g.col - 14, py - 14, 28, 28, 7); ctx.fill()
      ctx.fillStyle = '#f3a712'; ctx.fillRect(g.col - 4, py - 20, 8, 8)
      ctx.fillStyle = '#1d211d'; ctx.fillRect(g.col - 8, py - 6, 4, 4); ctx.fillRect(g.col + 4, py - 6, 4, 4)
      // collision
      if (state === 'play') {
        const lane = g.lanes[g.row]
        if (lane?.kind === 'road' && g.hop < 0.3) {
          for (const car of lane.cars) {
            if (g.col + 12 > car.x && g.col - 12 < car.x + car.w) {
              setState('over')
              setBest(b => {
                const nb = Math.max(b, g.row)
                try { localStorage.setItem('taproad2-best', String(nb)) } catch { /* ignore */ }
                return nb
              })
            }
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state])

  return (
    <section className="taproad">
      <div className="taproad-hud">
        <span>Pont: <strong>{score}</strong></span>
        <span>Rekord: <strong>{best}</strong></span>
      </div>
      <div className="taproad-wrap" onPointerDown={tap}>
        <canvas ref={canvasRef} width={W} height={H} />
        {state !== 'play' && (
          <div className="taproad-overlay">
            <h2>{state === 'over' ? 'Elütöttek!' : 'TapRoad 2'}</h2>
            <p>{state === 'over' ? `${score} sávot jutottál át.` : 'Koppints, hogy előre ugorj. Kerüld ki az autókat!'}</p>
            <button type="button">{state === 'over' ? 'Újra' : 'Indulás'}</button>
          </div>
        )}
      </div>
      <p className="round-count">Koppintás / Szóköz / ↑ = ugrás · ← → = oldalra lépés</p>
    </section>
  )
}
