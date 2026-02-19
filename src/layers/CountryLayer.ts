import { Layer, type LayerRenderContext } from './Layer'
import type { GPUContext } from '../core/gpu'
import { createBuffer, hexToRgba } from '../core/gpu'
import { polygonShader } from '../core/shaders'
import type { GeoJSON, GeoFeature } from '../core/types'
import earcut from 'earcut'

export class CountryLayer extends Layer {
  private vertexBuffer: GPUBuffer | null = null
  private indexBuffer: GPUBuffer | null = null
  private indexCount: number = 0
  private geoData: GeoJSON | null = null

  constructor() {
    super('countries')
  }

  async loadGeoJSON(url: string): Promise<void> {
    const response = await fetch(url)
    this.geoData = await response.json()
  }

  setGeoJSON(data: GeoJSON): void {
    this.geoData = data
  }

  async initialize(gpu: GPUContext): Promise<void> {
    this.gpu = gpu

    if (!this.geoData) {
      throw new Error('GeoJSON data not loaded')
    }

    // Triangulate all country polygons
    const { vertices, indices } = this.triangulateFeatures(this.geoData.features)

    this.vertexBuffer = createBuffer(
      gpu.device,
      new Float32Array(vertices),
      GPUBufferUsage.VERTEX
    )

    this.indexBuffer = createBuffer(
      gpu.device,
      new Uint32Array(indices),
      GPUBufferUsage.INDEX
    )

    this.indexCount = indices.length

    // Create uniform buffer for view matrix + color
    this.uniformBuffer = gpu.device.createBuffer({
      size: 64 + 16, // mat4 + vec4
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    // Create shader module
    const shaderModule = gpu.device.createShaderModule({
      code: polygonShader
    })

    // Create bind group layout
    const bindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }]
    })

    // Create pipeline
    this.pipeline = gpu.device.createRenderPipeline({
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 8, // 2 floats
          attributes: [{
            shaderLocation: 0,
            offset: 0,
            format: 'float32x2'
          }]
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

    // Create bind group
    this.bindGroup = gpu.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer }
      }]
    })
  }

  private triangulateFeatures(features: GeoFeature[]): { vertices: number[], indices: number[] } {
    const vertices: number[] = []
    const indices: number[] = []
    let vertexOffset = 0

    for (const feature of features) {
      const { geometry } = feature

      if (geometry.type === 'Polygon') {
        const result = this.triangulatePolygon(geometry.coordinates as number[][][])
        for (const v of result.vertices) {
          vertices.push(v)
        }
        for (const i of result.indices) {
          indices.push(i + vertexOffset)
        }
        vertexOffset += result.vertices.length / 2
      } else if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates as number[][][][]) {
          const result = this.triangulatePolygon(polygon)
          for (const v of result.vertices) {
            vertices.push(v)
          }
          for (const i of result.indices) {
            indices.push(i + vertexOffset)
          }
          vertexOffset += result.vertices.length / 2
        }
      }
    }

    return { vertices, indices }
  }

  private triangulatePolygon(rings: number[][][]): { vertices: number[], indices: number[] } {
    // Flatten rings for earcut
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

    return {
      vertices: flatCoords,
      indices: triangles
    }
  }

  render(ctx: LayerRenderContext, passEncoder: GPURenderPassEncoder): void {
    if (!this.visible || !this.pipeline || !this.bindGroup || !this.vertexBuffer || !this.indexBuffer) {
      return
    }

    // Update uniforms
    const landColor = hexToRgba(ctx.theme.land)
    landColor[3] *= this.opacity

    const uniformData = new Float32Array(20)
    uniformData.set(ctx.viewMatrix, 0)
    uniformData.set(landColor, 16)

    ctx.gpu.device.queue.writeBuffer(this.uniformBuffer!, 0, uniformData)

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
