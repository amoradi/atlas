import type { GPUContext } from '../core/gpu'
import type { Theme } from '../core/types'

export interface LayerRenderContext {
  gpu: GPUContext
  viewMatrix: Float32Array
  theme: Theme
}

export abstract class Layer {
  public id: string
  public visible: boolean = true
  public opacity: number = 1

  protected gpu: GPUContext | null = null
  protected pipeline: GPURenderPipeline | null = null
  protected bindGroup: GPUBindGroup | null = null
  protected uniformBuffer: GPUBuffer | null = null

  constructor(id: string) {
    this.id = id
  }

  abstract initialize(gpu: GPUContext): Promise<void>
  abstract render(ctx: LayerRenderContext, passEncoder: GPURenderPassEncoder): void

  setVisible(visible: boolean): void {
    this.visible = visible
  }

  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity))
  }

  destroy(): void {
    this.uniformBuffer?.destroy()
    this.pipeline = null
    this.bindGroup = null
  }
}
