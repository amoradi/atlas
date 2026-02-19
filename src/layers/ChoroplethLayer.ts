import { Layer, type LayerRenderContext } from './Layer'
import type { GPUContext } from '../core/gpu'
import { hexToRgba } from '../core/gpu'
import type { GeoJSON, GeoFeature } from '../core/types'
import { interpolateColor } from '../themes'
import earcut from 'earcut'

export interface ChoroplethValue {
  key: string  // Country code (ISO_A3) or name
  value: number
}

export interface ChoroplethOptions {
  colors?: [string, string]  // [min, max] gradient
  defaultColor?: string      // For countries without data
  opacity?: number
}

export class ChoroplethLayer extends Layer {
  private vertexBuffer: GPUBuffer | null = null
  private indexBuffer: GPUBuffer | null = null
  private indexCount: number = 0
  private geoData: GeoJSON | null = null
  private values: Map<string, number> = new Map()
  private minValue: number = 0
  private maxValue: number = 1
  private colors: [string, string] = ['#1a1a2e', '#66fcf1']
  private defaultColor: string = '#1f2833'

  constructor(id: string = 'choropleth') {
    super(id)
  }

  async loadGeoJSON(url: string): Promise<void> {
    const response = await fetch(url)
    this.geoData = await response.json()
  }

  setGeoJSON(data: GeoJSON): void {
    this.geoData = data
  }

  setValues(values: ChoroplethValue[], options?: ChoroplethOptions): void {
    this.values.clear()

    if (options?.colors) {
      this.colors = options.colors
    }
    if (options?.defaultColor) {
      this.defaultColor = options.defaultColor
    }
    if (options?.opacity !== undefined) {
      this.opacity = options.opacity
    }

    // Find min/max and populate map
    let min = Infinity
    let max = -Infinity
    for (const v of values) {
      this.values.set(v.key.toUpperCase(), v.value)
      min = Math.min(min, v.value)
      max = Math.max(max, v.value)
    }
    this.minValue = min
    this.maxValue = max

    if (this.gpu && this.geoData) {
      this.buildBuffers()
    }
  }

  private getColorForFeature(feature: GeoFeature): [number, number, number, number] {
    const props = feature.properties
    // Try different property names for country identification
    const keys = [
      props.iso,        // bundled data
      props.ISO_A3,
      props.iso_a3,
      props.ADM0_A3,
      props.name,       // bundled data
      props.NAME,
      props.ADMIN
    ].filter(Boolean).map(k => String(k).toUpperCase())

    for (const key of keys) {
      if (this.values.has(key)) {
        const value = this.values.get(key)!
        const rawT = this.maxValue !== this.minValue
          ? (value - this.minValue) / (this.maxValue - this.minValue)
          : 0.5
        // Compress range to 0.25-0.75 for less extreme colors
        const t = 0.25 + rawT * 0.5
        const color = interpolateColor(this.colors[0], this.colors[1], t)
        const rgba = hexToRgba(color)
        rgba[3] *= this.opacity
        return rgba
      }
    }

    const rgba = hexToRgba(this.defaultColor)
    rgba[3] *= this.opacity
    return rgba
  }

  private buildBuffers(): void {
    if (!this.gpu || !this.geoData) return

    const vertices: number[] = []
    const indices: number[] = []
    let vertexOffset = 0

    for (const feature of this.geoData.features) {
      const color = this.getColorForFeature(feature)
      const { geometry } = feature

      const polygons: number[][][][] = geometry.type === 'Polygon'
        ? [geometry.coordinates as number[][][]]
        : geometry.coordinates as number[][][][]

      for (const polygon of polygons) {
        const result = this.triangulatePolygon(polygon, color)

        for (const v of result.vertices) {
          vertices.push(v)
        }
        for (const i of result.indices) {
          indices.push(i + vertexOffset)
        }
        vertexOffset += result.vertexCount
      }
    }

    this.indexCount = indices.length

    // Create buffers
    this.vertexBuffer?.destroy()
    this.indexBuffer?.destroy()

    this.vertexBuffer = this.gpu.device.createBuffer({
      size: vertices.length * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })
    this.gpu.device.queue.writeBuffer(this.vertexBuffer, 0, new Float32Array(vertices))

    this.indexBuffer = this.gpu.device.createBuffer({
      size: indices.length * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    })
    this.gpu.device.queue.writeBuffer(this.indexBuffer, 0, new Uint32Array(indices))
  }

  private triangulatePolygon(
    rings: number[][][],
    color: [number, number, number, number]
  ): { vertices: number[], indices: number[], vertexCount: number } {
    const flatCoords: number[] = []
    const holeIndices: number[] = []

    for (let i = 0; i < rings.length; i++) {
      if (i > 0) {
        holeIndices.push(flatCoords.length / 2)
      }
      for (const coord of rings[i]) {
        flatCoords.push(coord[0], coord[1])
      }
    }

    const triangles = earcut(flatCoords, holeIndices, 2)

    // Build vertices with color: x, y, r, g, b, a
    const vertices: number[] = []
    const vertexCount = flatCoords.length / 2

    for (let i = 0; i < flatCoords.length; i += 2) {
      vertices.push(
        flatCoords[i],     // x
        flatCoords[i + 1], // y
        color[0],          // r
        color[1],          // g
        color[2],          // b
        color[3]           // a
      )
    }

    return { vertices, indices: triangles, vertexCount }
  }

  async initialize(gpu: GPUContext): Promise<void> {
    this.gpu = gpu

    // Create uniform buffer for view matrix
    this.uniformBuffer = gpu.device.createBuffer({
      size: 64, // mat4
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    const shaderModule = gpu.device.createShaderModule({
      code: /* wgsl */ `
        struct Uniforms {
          viewMatrix: mat4x4<f32>,
        }

        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VertexInput {
          @location(0) position: vec2<f32>,
          @location(1) color: vec4<f32>,
        }

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
        }

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          output.position = uniforms.viewMatrix * vec4<f32>(input.position, 0.0, 1.0);
          output.color = input.color;
          return output;
        }

        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
          return input.color;
        }
      `
    })

    const bindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' }
      }]
    })

    this.pipeline = gpu.device.createRenderPipeline({
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 24, // 6 floats * 4 bytes
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
            { shaderLocation: 1, offset: 8, format: 'float32x4' }   // color
          ]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: gpu.format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      }
    })

    this.bindGroup = gpu.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer }
      }]
    })

    // Build initial buffers if we have data
    if (this.geoData && this.values.size > 0) {
      this.buildBuffers()
    }
  }

  render(ctx: LayerRenderContext, passEncoder: GPURenderPassEncoder): void {
    if (!this.visible || !this.pipeline || !this.bindGroup || !this.vertexBuffer || !this.indexBuffer || this.indexCount === 0) {
      return
    }

    // Update view matrix
    ctx.gpu.device.queue.writeBuffer(this.uniformBuffer!, 0, ctx.viewMatrix.buffer)

    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(0, this.bindGroup)
    passEncoder.setVertexBuffer(0, this.vertexBuffer)
    passEncoder.setIndexBuffer(this.indexBuffer, 'uint32')
    passEncoder.drawIndexed(this.indexCount)
  }

  destroy(): void {
    super.destroy()
    this.vertexBuffer?.destroy()
    this.indexBuffer?.destroy()
  }
}
