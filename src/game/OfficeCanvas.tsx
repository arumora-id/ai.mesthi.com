import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import type { Agent, Page } from '../core/domain'
import { OfficeScene } from './OfficeScene'
export default function OfficeCanvas({
  agents,
  onAgent,
  onNavigate,
  motion = true,
}: {
  agents: Agent[]
  onAgent: (a: Agent) => void
  onNavigate: (page: Page) => void
  motion?: boolean
}) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<OfficeScene | null>(null),
    callbacks = useRef({ onAgent, onNavigate }),
    [error, setError] = useState(false)
  callbacks.current = { onAgent, onNavigate }
  useEffect(() => {
    if (!host.current) return
    try {
      const office = new OfficeScene(
        agents,
        (a) => callbacks.current.onAgent(a),
        (p) => callbacks.current.onNavigate(p),
      )
      scene.current = office
      const game = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: host.current,
        width: 960,
        height: 600,
        backgroundColor: '#dce5d4',
        pixelArt: true,
        antialias: false,
        scene: office,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        fps: { target: 30, forceSetTimeOut: true },
        banner: false,
        audio: { noAudio: true },
      })
      return () => {
        scene.current = null
        game.destroy(true)
      }
    } catch {
      setError(true)
    }
  }, [])
  useEffect(() => {
    scene.current?.sync(agents)
  }, [agents])
  useEffect(() => {
    // Phaser listens at the window level, including clicks on native dialogs above its canvas.
    const updateInteraction = () => {
      scene.current?.setInteraction(!document.querySelector('dialog[open]'))
    }
    const observer = new MutationObserver(updateInteraction)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open'],
    })
    updateInteraction()
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => scene.current?.setMotion(motion && !media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [motion])
  return error ? (
    <div className="office-fallback">
      Office rendering is unavailable. Use the team and task views to continue.
    </div>
  ) : (
    <div ref={host} className="office-canvas" data-testid="office-canvas" />
  )
}
