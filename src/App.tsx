import { useState } from 'react'
import './App.css'
import NeonRun from './NeonRun'

type CoinSide = 'fej' | 'írás'

function App() {
  const [side, setSide] = useState<CoinSide>('fej')
  const [tab, setTab] = useState<'coin' | 'neon'>('coin')
  const [flipping, setFlipping] = useState(false)
  const [heads, setHeads] = useState(0)
  const [tails, setTails] = useState(0)

  const flipCoin = () => {
    if (flipping) return

    setFlipping(true)
    const result: CoinSide = Math.random() < 0.5 ? 'fej' : 'írás'

    window.setTimeout(() => {
      setSide(result)
      setHeads((value) => value + (result === 'fej' ? 1 : 0))
      setTails((value) => value + (result === 'írás' ? 1 : 0))
      setFlipping(false)
    }, 850)
  }

  const reset = () => {
    if (flipping) return
    setHeads(0)
    setTails(0)
    setSide('fej')
  }

  const total = heads + tails

  return (
    <main className="game">
      <header>
        <div className="brand">
          <span className="brand-mark">H/I</span>
          <span>Érmecsináló</span>
        </div>
        <nav className="tabs">
          <button type="button" className={tab === 'coin' ? 'active' : ''} onClick={() => setTab('coin')}>Érme</button>
          <button type="button" className={tab === 'neon' ? 'active' : ''} onClick={() => setTab('neon')}>Neonfutam</button>
          {tab === 'coin' && (
            <button className="reset-button" type="button" onClick={reset} disabled={flipping || total === 0}>
              Újrakezdés
            </button>
          )}
        </nav>
      </header>

      {tab === 'neon' ? <NeonRun /> : (

      <section className="game-board" aria-live="polite">
        <div className="scoreboard" aria-label="Dobás eredmények">
          <div>
            <span>Fej</span>
            <strong>{heads}</strong>
          </div>
          <div className="score-divider" />
          <div>
            <span>Írás</span>
            <strong>{tails}</strong>
          </div>
        </div>

        <div className="coin-stage">
          <div className={`coin ${flipping ? 'is-flipping' : ''} ${side === 'írás' ? 'show-tails' : ''}`}>
            <div className="coin-face heads-face">
              <span className="crown">♛</span>
              <span className="face-name">FEJ</span>
            </div>
            <div className="coin-face tails-face">
              <span className="crown">◆</span>
              <span className="face-name">ÍRÁS</span>
            </div>
          </div>
          <div className="coin-shadow" />
        </div>

        <div className="result">
          <p>{flipping ? 'Pörög…' : total === 0 ? 'Készen áll' : 'Az eredmény'}</p>
          <h1>{flipping ? '—' : side.toUpperCase()}</h1>
        </div>

        <button className="flip-button" type="button" onClick={flipCoin} disabled={flipping}>
          {flipping ? 'Dobás…' : 'Érmet dobok'}
        </button>

        <p className="round-count">Összes dobás: {total}</p>
      </section>
      )}
    </main>
  )
}

export default App
