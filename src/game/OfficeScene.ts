import Phaser from 'phaser'
import type { Agent, Page } from '../core/domain'
import { findPath } from './pathfinding'
type Worker = {
  container: Phaser.GameObjects.Container
  sprite: Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  dot: Phaser.GameObjects.Arc
  state: string
  moving: boolean
}
export class OfficeScene extends Phaser.Scene {
  private workers = new Map<string, Worker>()
  private people: Agent[] = []
  private blocked = new Set<string>()
  private loaded = false
  private reducedMotion = false
  private onSelect: (a: Agent) => void
  private onObject: (page: Page) => void
  private stations = [
    { x: 7, y: 7 },
    { x: 13, y: 7 },
    { x: 7, y: 12 },
    { x: 13, y: 12 },
    { x: 23, y: 7 },
    { x: 20, y: 12 },
    { x: 25, y: 12 },
    { x: 17, y: 15 },
  ]
  constructor(agents: Agent[], onSelect: (a: Agent) => void, onObject: (page: Page) => void) {
    super('MesthiOffice')
    this.people = agents
    this.onSelect = onSelect
    this.onObject = onObject
  }
  private rect(x: number, y: number, w: number, h: number, color: number) {
    return this.add.rectangle(x, y, w, h, color).setOrigin(0)
  }
  private text(x: number, y: number, text: string, size = 13, color = '#566a60') {
    return this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: size + 'px', color })
      .setDepth(4)
  }
  private furniture(x: number, y: number, w: number, h: number, page: Page, label: string) {
    const zone = this.add
      .zone(x, y, w, h)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(6)
    const tip = this.text(x, y - 21, label, 12, '#203e31')
      .setBackgroundColor('#f5f4df')
      .setPadding(5, 3)
      .setVisible(false)
      .setDepth(50)
    zone.on('pointerover', () => tip.setVisible(true))
    zone.on('pointerout', () => tip.setVisible(false))
    zone.on('pointerdown', () => this.onObject(page))
    for (let col = Math.floor(x / 30); col <= Math.floor((x + w - 1) / 30); col++)
      for (let row = Math.floor(y / 30); row <= Math.floor((y + h - 1) / 30); row++)
        this.blocked.add(col + ',' + row)
  }
  private plant(x: number, y: number) {
    this.rect(x + 5, y + 25, 25, 20, 0xa98263)
    this.rect(x + 9, y + 42, 17, 4, 0x846951)
    this.rect(x + 15, y + 3, 6, 29, 0x537451)
    this.rect(x, y + 10, 17, 14, 0x709769)
    this.rect(x + 20, y, 15, 19, 0x86a477)
    this.rect(x + 3, y + 4, 10, 7, 0x96b681)
  }
  private desk(x: number, y: number) {
    this.rect(x + 7, y + 12, 145, 71, 0x9e9b84)
    this.rect(x, y, 145, 67, 0xb9926f)
    this.rect(x + 3, y + 3, 139, 55, 0xd7b793)
    this.rect(x + 5, y + 60, 135, 7, 0xc29c77)
    this.rect(x + 46, y + 7, 51, 31, 0x344e45)
    this.rect(x + 50, y + 10, 43, 24, 0x8da99a)
    this.rect(x + 54, y + 15, 23, 3, 0xd5e5b6)
    this.rect(x + 54, y + 21, 33, 2, 0xb5cdbd)
    this.rect(x + 54, y + 26, 20, 2, 0xb5cdbd)
    this.rect(x + 69, y + 38, 6, 6, 0x53675d)
    this.rect(x + 57, y + 44, 30, 4, 0x53675d)
    this.rect(x + 53, y + 52, 40, 7, 0xe7e4cd)
    this.rect(x + 13, y + 31, 21, 25, 0xf4edcf)
    this.rect(x + 18, y + 36, 11, 2, 0xadc0a2)
    this.rect(x + 18, y + 42, 11, 2, 0xadc0a2)
    this.rect(x + 116, y + 39, 10, 12, 0xf4ebd0)
    this.rect(x + 53, y + 79, 41, 28, 0x6c8a77)
    this.rect(x + 55, y + 80, 37, 21, 0x86a08d)
    this.rect(x + 60, y + 107, 28, 6, 0x566e60)
    this.furniture(x, y, 145, 67, 'runs', 'Computer · Open tasks')
  }
  create() {
    this.loaded = true
    this.reducedMotion =
      this.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.loaded = false
    })
    this.cameras.main.setBackgroundColor('#dce5d4')
    this.rect(53, 53, 861, 518, 0xb4bda8)
    this.rect(44, 35, 860, 520, 0xcad0b9)
    for (let y = 65; y < 543; y += 30)
      for (let x = 55; x < 895; x += 30)
        this.rect(x, y, 29, 29, ((x + y) / 30) % 3 < 1 ? 0xe6e5cb : 0xeae8d1)
    this.rect(44, 35, 860, 28, 0xaebfae)
    this.rect(44, 60, 11, 495, 0xaebfae)
    this.rect(55, 60, 849, 7, 0xc7d2bd)
    for (const x of [180, 385]) {
      this.rect(x, 30, 140, 60, 0x8faaa0)
      this.rect(x + 6, 36, 128, 45, 0xb5d4ce)
      this.rect(x + 66, 35, 5, 50, 0xe0e8d4)
      this.rect(x + 3, 82, 134, 7, 0xededd3)
      this.rect(x + 12, 42, 40, 3, 0xcde3d9)
    }
    this.text(70, 94, 'MESTHI / CREATIVE FLOOR', 12)
    this.rect(156, 118, 425, 297, 0xd8dbc1)
    for (const [x, y] of [
      [159, 135],
      [345, 135],
      [159, 285],
      [345, 285],
    ])
      this.desk(x, y)
    this.rect(622, 93, 246, 327, 0xd8e0cc)
    this.rect(618, 91, 4, 258, 0xb1c7b6)
    this.rect(627, 94, 239, 4, 0xb1c7b6)
    this.rect(665, 110, 169, 84, 0x9caa99)
    this.rect(670, 114, 159, 72, 0xf1f1df)
    this.text(686, 121, 'THE NEXT BIG IDEA', 12)
    for (const [x, y, color] of [
      [688, 145, 0xe5cb8b],
      [728, 145, 0xa6c5ad],
      [768, 145, 0xc5aed0],
    ]) {
      this.rect(x, y, 24, 23, color)
      this.rect(x + 4, y + 6, 14, 2, 0x778974)
      this.rect(x + 4, y + 12, 10, 2, 0x778974)
    }
    this.furniture(665, 110, 169, 84, 'workflows', 'Whiteboard · Workflows')
    this.rect(666, 269, 166, 91, 0xbda381)
    this.rect(662, 258, 166, 91, 0xd6b994)
    this.rect(668, 262, 154, 77, 0xe0c8a4)
    for (const x of [680, 767]) {
      this.rect(x, 234, 40, 21, 0x88a392)
      this.rect(x, 358, 40, 21, 0x88a392)
    }
    this.rect(704, 290, 31, 23, 0xf7edcf)
    this.rect(754, 282, 31, 23, 0x576e62)
    this.rect(757, 285, 25, 17, 0xa5c2a8)
    this.furniture(662, 258, 166, 91, 'approvals', 'Meeting table · Approvals')
    this.text(684, 397, 'THE THINKING ROOM', 12)
    this.rect(65, 158, 59, 170, 0x977957)
    this.rect(69, 160, 49, 163, 0xc0a57f)
    for (let row = 0; row < 4; row++) {
      for (let b = 0; b < 5; b++)
        this.rect(
          72 + b * 8,
          164 + row * 39,
          6,
          24 + (b % 3) * 3,
          [0x89a389, 0xb3c1a1, 0xc99a88, 0xb8a0c1, 0xd4c099][b],
        )
      this.rect(67, 195 + row * 39, 54, 5, 0x997e5c)
    }
    this.furniture(65, 158, 59, 170, 'knowledge', 'Bookshelf · Knowledge & skills')
    this.rect(78, 437, 131, 51, 0xc2a684)
    this.rect(75, 433, 131, 45, 0xe1cba9)
    this.rect(83, 436, 36, 34, 0x617c6a)
    this.rect(88, 441, 26, 18, 0x324e40)
    this.rect(93, 463, 16, 7, 0xeee8ce)
    this.text(79, 493, 'COFFEE & CONTEXT', 11)
    this.furniture(75, 433, 131, 45, 'agents', 'Coffee bar · Your agents')
    this.rect(282, 444, 184, 58, 0x77927d)
    this.rect(279, 435, 184, 53, 0x92aa8a)
    this.rect(283, 437, 176, 17, 0xaac09b)
    this.rect(285, 459, 81, 26, 0xacc39c)
    this.rect(375, 459, 81, 26, 0xacc39c)
    this.rect(334, 514, 76, 24, 0xccb99a)
    this.furniture(279, 435, 184, 53, 'agents', 'Lounge · Team overview')
    this.rect(675, 458, 111, 52, 0x4c665b)
    this.rect(680, 462, 101, 40, 0x759785)
    this.text(689, 470, 'TEAM PULSE', 12, '#e6edd4')
    for (let i = 0; i < 6; i++)
      this.rect(690 + i * 14, 496 - (i % 4) * 3, 8, 5 + (i % 4) * 3, 0xc5dd9e)
    this.furniture(675, 458, 111, 52, 'usage', 'Team display · Usage')
    this.rect(851, 459, 44, 73, 0xc1a685)
    this.rect(857, 465, 32, 61, 0x719485)
    this.furniture(851, 459, 44, 73, 'templates', 'Door · Workforce packs')
    for (const [x, y] of [
      [78, 75],
      [843, 66],
      [540, 85],
      [552, 460],
      [834, 348],
    ])
      this.plant(x, y)
    this.text(650, 535, 'A LITTLE SPACE. BIG POSSIBILITIES.', 11)
    for (let x = 0; x < 32; x++)
      for (let y = 0; y < 20; y++)
        if (x < 2 || x > 29 || y < 3 || y > 17) this.blocked.add(x + ',' + y)
    this.sync(this.people)
    this.time.addEvent({ delay: 5500, loop: true, callback: () => this.wander() })
    this.game.canvas.setAttribute('role', 'img')
    this.game.canvas.setAttribute(
      'aria-label',
      'Interactive pixel office with agents, desks, whiteboard, library, lounge, and team display',
    )
  }
  private makeTexture(a: Agent) {
    const key = 'agent-' + a.id
    if (this.textures.exists(key)) return key
    const canvas = this.textures.createCanvas(key, 20, 26)!,
      ctx = canvas.getContext()
    const pixel = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    }
    pixel(3, 23, 15, 2, '#8e9b7e')
    pixel(6, 19, 4, 5, '#394f46')
    pixel(12, 19, 4, 5, '#394f46')
    pixel(4, 12, 14, 9, a.color)
    pixel(2, 14, 3, 6, '#eacda6')
    pixel(17, 14, 3, 6, '#eacda6')
    pixel(5, 3, 12, 11, '#f0d4ae')
    pixel(4, 1, 14, 5, '#53614c')
    pixel(4, 5, 3, 4, '#53614c')
    pixel(8, 7, 2, 2, '#354638')
    pixel(14, 7, 2, 2, '#354638')
    pixel(10, 11, 3, 1, '#b78d76')
    canvas.refresh()
    return key
  }
  sync(agents: Agent[]) {
    this.people = agents
    if (!this.loaded) return
    for (const [id, w] of this.workers)
      if (!agents.some((a) => a.id === id)) {
        w.container.destroy()
        this.workers.delete(id)
      }
    agents.slice(0, 8).forEach((a, i) => {
      let w = this.workers.get(a.id)
      if (!w) {
        const p = this.stations[i],
          sprite = this.add.sprite(0, 0, this.makeTexture(a)).setScale(1.7).setOrigin(0.5, 0.9)
        const label = this.add
            .text(0, 13, a.name, {
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#f3f0dc',
              backgroundColor: '#3d5848',
              padding: { x: 5, y: 3 },
            })
            .setOrigin(0.5),
          dot = this.add.circle(0, -48, 4, 0x769874)
        const container = this.add
          .container(p.x * 30 + 15, p.y * 30 + 15, [sprite, label, dot])
          .setDepth(10)
          .setSize(46, 67)
          .setInteractive({ useHandCursor: true })
        container.on('pointerdown', () => {
          const current = this.people.find((p) => p.id === a.id)
          if (current) this.onSelect(current)
        })
        w = { container, sprite, label, dot, state: a.state, moving: false }
        this.workers.set(a.id, w)
      }
      w.state = a.state
      w.label.setText(a.name)
      w.dot.setFillStyle(
        a.state === 'working' ? 0xa2cc65 : a.state === 'waiting_approval' ? 0xe1b268 : 0x819c80,
      )
      if (a.avatar && w.sprite.texture.key !== 'custom-' + a.id + '-' + a.avatar.version)
        this.customAvatar(a, w)
    })
  }
  private customAvatar(a: Agent, w: Worker) {
    const avatar = a.avatar!,
      key = 'custom-' + a.id + '-' + avatar.version
    if (this.textures.exists(key)) {
      w.sprite.setTexture(key).setDisplaySize(38, 45)
      return
    }
    const img = new window.Image()
    img.onload = () => {
      if (
        !this.loaded ||
        !w.sprite.scene ||
        this.textures.exists(key) ||
        this.people.find((p) => p.id === a.id)?.avatar?.version !== avatar.version
      )
        return
      this.textures.addSpriteSheet(key, img, {
        frameWidth: avatar.frameWidth,
        frameHeight: avatar.frameHeight,
      })
      w.sprite.setTexture(key, 0).setDisplaySize(38, 45)
    }
    img.src = avatar.dataUrl
  }
  private wander() {
    if (this.reducedMotion) return
    for (const [id, w] of this.workers) {
      if (w.moving || ['working', 'paused', 'waiting_approval', 'blocked'].includes(w.state))
        continue
      const index = this.people.findIndex((a) => a.id === id),
        destinations = [
          this.stations[index % this.stations.length],
          { x: 17, y: 14 },
          { x: 21, y: 7 },
          { x: 8, y: 16 },
        ],
        target = destinations[Math.floor(Math.random() * destinations.length)]
      const path = findPath(
        { x: Math.floor(w.container.x / 30), y: Math.floor(w.container.y / 30) },
        target,
        32,
        20,
        this.blocked,
      )
      if (path.length < 2) continue
      w.moving = true
      const move = (n: number) => {
        if (n >= path.length || !w.container.scene) {
          w.moving = false
          return
        }
        this.tweens.add({
          targets: w.container,
          x: path[n].x * 30 + 15,
          y: path[n].y * 30 + 15,
          duration: 190,
          onComplete: () => move(n + 1),
        })
      }
      move(1)
    }
  }
  setMotion(enabled: boolean) {
    this.reducedMotion = !enabled
    if (!enabled && this.loaded) {
      this.tweens.killAll()
      this.workers.forEach((w) => {
        w.moving = false
      })
    }
  }
}
