import type { Camera, Bounds } from './types'

export class CameraController {
  public camera: Camera = { x: 0, y: 0, zoom: 1 }
  private canvas: HTMLCanvasElement
  private isDragging = false
  private lastPointer = { x: 0, y: 0 }
  private onChange: () => void

  // World bounds in Mercator coordinates
  private bounds: Bounds = {
    minX: -180,
    maxX: 180,
    minY: -85,
    maxY: 85
  }

  constructor(canvas: HTMLCanvasElement, onChange: () => void) {
    this.canvas = canvas
    this.onChange = onChange
    this.setupEventListeners()
    this.canvas.style.cursor = 'grab'
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onPointerUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })

    // Touch events for mobile
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false })
    this.canvas.addEventListener('touchend', this.onTouchEnd)
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.isDragging = true
    this.lastPointer = { x: e.clientX, y: e.clientY }
    this.canvas.setPointerCapture(e.pointerId)
    this.canvas.style.cursor = 'grabbing'
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return

    const dx = e.clientX - this.lastPointer.x
    const dy = e.clientY - this.lastPointer.y

    // Convert pixel movement to world coordinates
    const scale = this.getScale()
    this.camera.x -= dx / scale
    this.camera.y += dy / scale // Y is inverted

    this.lastPointer = { x: e.clientX, y: e.clientY }
    this.clampCamera()
    this.onChange()
  }

  private onPointerUp = (e: PointerEvent): void => {
    this.isDragging = false
    this.canvas.releasePointerCapture(e.pointerId)
    this.canvas.style.cursor = 'grab'
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()

    // Handle horizontal panning (trackpad swipe)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      const scale = this.getScale()
      this.camera.x += e.deltaX / scale
      this.camera.y -= e.deltaY / scale
      this.clampCamera()
      this.onChange()
      return
    }

    // Smaller steps for smoother trackpad zooming
    const zoomIntensity = 0.002
    const zoomFactor = 1 - e.deltaY * zoomIntensity
    const newZoom = Math.max(0.5, Math.min(20, this.camera.zoom * zoomFactor))

    // Zoom towards mouse position
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const worldBefore = this.screenToWorld(mouseX, mouseY)
    this.camera.zoom = newZoom
    const worldAfter = this.screenToWorld(mouseX, mouseY)

    this.camera.x += worldBefore[0] - worldAfter[0]
    this.camera.y += worldBefore[1] - worldAfter[1]

    this.clampCamera()
    this.onChange()
  }

  private touchStartDistance = 0
  private touchStartZoom = 1

  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      this.touchStartDistance = Math.sqrt(dx * dx + dy * dy)
      this.touchStartZoom = this.camera.zoom
    }
  }

  private onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const scale = distance / this.touchStartDistance
      this.camera.zoom = Math.max(0.5, Math.min(20, this.touchStartZoom * scale))
      this.onChange()
    }
  }

  private onTouchEnd = (): void => {
    this.touchStartDistance = 0
  }

  private getScale(): number {
    const worldWidth = this.bounds.maxX - this.bounds.minX
    return (this.canvas.width / worldWidth) * this.camera.zoom
  }

  private clampCamera(): void {
    // Optional: clamp camera to world bounds
    const halfWorldWidth = (this.bounds.maxX - this.bounds.minX) / 2
    const halfWorldHeight = (this.bounds.maxY - this.bounds.minY) / 2

    this.camera.x = Math.max(-halfWorldWidth, Math.min(halfWorldWidth, this.camera.x))
    this.camera.y = Math.max(-halfWorldHeight, Math.min(halfWorldHeight, this.camera.y))
  }

  screenToWorld(screenX: number, screenY: number): [number, number] {
    const scale = this.getScale()
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    const worldX = (screenX - centerX) / scale + this.camera.x
    const worldY = -(screenY - centerY) / scale + this.camera.y

    return [worldX, worldY]
  }

  worldToScreen(worldX: number, worldY: number): [number, number] {
    const scale = this.getScale()
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    const screenX = (worldX - this.camera.x) * scale + centerX
    const screenY = -(worldY - this.camera.y) * scale + centerY

    return [screenX, screenY]
  }

  setCenter(lng: number, lat: number): void {
    this.camera.x = lng
    this.camera.y = lat
    this.clampCamera()
    this.onChange()
  }

  setZoom(zoom: number): void {
    this.camera.zoom = Math.max(0.5, Math.min(20, zoom))
    this.onChange()
  }

  getViewMatrix(): Float32Array {
    const scale = this.getScale()
    const aspectRatio = this.canvas.width / this.canvas.height

    // Create orthographic projection matrix combined with view transform
    const scaleX = (2 * scale) / this.canvas.width
    const scaleY = (2 * scale) / this.canvas.height

    return new Float32Array([
      scaleX, 0, 0, 0,
      0, scaleY, 0, 0,
      0, 0, 1, 0,
      -this.camera.x * scaleX, -this.camera.y * scaleY, 0, 1
    ])
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    this.canvas.removeEventListener('touchmove', this.onTouchMove)
    this.canvas.removeEventListener('touchend', this.onTouchEnd)
  }
}
