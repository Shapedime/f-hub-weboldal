import { useRef } from 'react'

// The Unity WebGL build lives in public/beach-volley and is served as-is by Vite.
const GAME_URL = `${import.meta.env.BASE_URL}beach-volley/index.html`

export default function BeachVolley() {
  const frame = useRef<HTMLIFrameElement>(null)

  const fullscreen = () => {
    frame.current?.requestFullscreen?.().catch(() => {})
  }

  return (
    <section className="beachvolley">
      <div className="bv-frame">
        <iframe
          ref={frame}
          src={GAME_URL}
          title="Beach Volley"
          allow="fullscreen; autoplay; gamepad"
          allowFullScreen
        />
      </div>
      <div className="bv-bar">
        <p>Unity 3D strandröplabda. Az első betöltés eltarthat egy kicsit. Billentyűzettel és egérrel a legjobb.</p>
        <button type="button" onClick={fullscreen}>Teljes képernyő</button>
      </div>
    </section>
  )
}
