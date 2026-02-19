import { initWebGPU, hexToRgba, type GPUContext } from './core/gpu'
import { CameraController } from './core/camera'
import type { AtlasOptions, Theme, ThemeName, AtlasEvent } from './core/types'
import { getTheme } from './themes'
import { Layer, type LayerRenderContext } from './layers/Layer'
import { CountryLayer } from './layers/CountryLayer'
import { PointsLayer, type PointData } from './layers/PointsLayer'
import { ChoroplethLayer, type ChoroplethValue, type ChoroplethOptions } from './layers/ChoroplethLayer'

type EventCallback = (event: AtlasEvent) => void

export class Atlas {
  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private gpu: GPUContext | null = null
  private camera: CameraController | null = null
  private theme: Theme
  private layers: Map<string, Layer> = new Map()
  private eventListeners: Map<string, Set<EventCallback>> = new Map()
  private animationFrameId: number | null = null
  private initialized = false

  constructor(options: AtlasOptions) {
    // Get container
    if (typeof options.container === 'string') {
      const el = document.querySelector(options.container)
      if (!el) throw new Error(`Container not found: ${options.container}`)
      this.container = el as HTMLElement
    } else {
      this.container = options.container
    }

    // Create canvas
    this.canvas = document.createElement('canvas')
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.display = 'block'
    this.container.appendChild(this.canvas)

    // Set theme
    this.theme = getTheme(options.theme || 'dark')

    // Initialize
    this.init(options)
  }

  private async init(options: AtlasOptions): Promise<void> {
    // Setup canvas size
    this.resize()
    window.addEventListener('resize', this.resize)

    // Initialize WebGPU
    this.gpu = await initWebGPU(this.canvas)

    // Setup camera
    this.camera = new CameraController(this.canvas, () => this.render())

    if (options.center) {
      this.camera.setCenter(options.center[0], options.center[1])
    }
    if (options.zoom) {
      this.camera.setZoom(options.zoom)
    }

    // Setup click events
    this.canvas.addEventListener('click', this.handleClick)

    this.initialized = true

    // Start render loop
    this.render()
  }

  private resize = (): void => {
    const rect = this.container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr

    if (this.initialized) {
      this.render()
    }
  }

  private handleClick = (e: MouseEvent): void => {
    if (!this.camera) return

    const rect = this.canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height)

    const [lng, lat] = this.camera.screenToWorld(x, y)

    const event: AtlasEvent = {
      type: 'click',
      lngLat: [lng, lat],
      pixel: [e.clientX - rect.left, e.clientY - rect.top]
    }

    this.emit('click', event)
  }

  private render = (): void => {
    if (!this.gpu || !this.camera) return

    const { device, context, format } = this.gpu

    // Get current texture
    const textureView = context.getCurrentTexture().createView()

    // Create command encoder
    const commandEncoder = device.createCommandEncoder()

    // Clear with background color
    const bgColor = hexToRgba(this.theme.background)
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: bgColor[0], g: bgColor[1], b: bgColor[2], a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    })

    // Render layers
    const ctx: LayerRenderContext = {
      gpu: this.gpu,
      viewMatrix: this.camera.getViewMatrix(),
      theme: this.theme
    }

    // Render all layer fills
    for (const layer of this.layers.values()) {
      layer.render(ctx, passEncoder)
    }

    // Render borders on top of everything
    for (const layer of this.layers.values()) {
      if (layer instanceof CountryLayer) {
        layer.renderBorders(ctx, passEncoder)
      }
    }

    passEncoder.end()

    // Submit
    device.queue.submit([commandEncoder.finish()])
  }

  async addCountryLayer(geoJsonUrl?: string): Promise<CountryLayer> {
    const layer = new CountryLayer()
    if (geoJsonUrl) {
      await layer.loadGeoJSON(geoJsonUrl)
    }
    await layer.initialize(this.gpu!)
    this.layers.set(layer.id, layer)
    this.render()
    return layer
  }

  async addPointsLayer(id: string, points: PointData[]): Promise<PointsLayer> {
    const layer = new PointsLayer(id)
    layer.setPoints(points)
    await layer.initialize(this.gpu!)
    this.layers.set(layer.id, layer)
    this.render()
    return layer
  }

  updatePoints(layerId: string, points: PointData[]): void {
    const layer = this.layers.get(layerId)
    if (layer instanceof PointsLayer) {
      layer.setPoints(points)
      this.render()
    }
  }

  async addChoroplethLayer(
    id: string,
    values: ChoroplethValue[],
    options?: ChoroplethOptions & { geoJsonUrl?: string }
  ): Promise<ChoroplethLayer> {
    const layer = new ChoroplethLayer(id)
    if (options?.geoJsonUrl) {
      await layer.loadGeoJSON(options.geoJsonUrl)
    }
    await layer.initialize(this.gpu!)
    layer.setValues(values, options)
    this.layers.set(layer.id, layer)
    this.render()
    return layer
  }

  updateChoropleth(layerId: string, values: ChoroplethValue[], options?: ChoroplethOptions): void {
    const layer = this.layers.get(layerId)
    if (layer instanceof ChoroplethLayer) {
      layer.setValues(values, options)
      this.render()
    }
  }

  addLayer(layer: Layer): void {
    this.layers.set(layer.id, layer)
    if (this.gpu) {
      layer.initialize(this.gpu).then(() => this.render())
    }
  }

  getLayer(id: string): Layer | undefined {
    return this.layers.get(id)
  }

  removeLayer(id: string): void {
    const layer = this.layers.get(id)
    if (layer) {
      layer.destroy()
      this.layers.delete(id)
      this.render()
    }
  }

  setTheme(theme: ThemeName | Theme): void {
    this.theme = getTheme(theme)
    this.render()
  }

  setCenter(lng: number, lat: number): void {
    this.camera?.setCenter(lng, lat)
  }

  setZoom(zoom: number): void {
    this.camera?.setZoom(zoom)
  }

  getCenter(): [number, number] | null {
    if (!this.camera) return null
    return [this.camera.camera.x, this.camera.camera.y]
  }

  getZoom(): number | null {
    return this.camera?.camera.zoom ?? null
  }

  refresh(): void {
    this.render()
  }

  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  off(event: string, callback: EventCallback): void {
    this.eventListeners.get(event)?.delete(callback)
  }

  private emit(event: string, data: AtlasEvent): void {
    this.eventListeners.get(event)?.forEach(cb => cb(data))
  }

  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
    }
    window.removeEventListener('resize', this.resize)
    this.canvas.removeEventListener('click', this.handleClick)
    this.camera?.destroy()

    for (const layer of this.layers.values()) {
      layer.destroy()
    }
    this.layers.clear()

    this.canvas.remove()
  }
}
