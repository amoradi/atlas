import { Layer, type LayerRenderContext } from './Layer'
import type { GPUContext } from '../core/gpu'
import { hexToRgba } from '../core/gpu'

export interface PointData {
  lng: number
  lat: number
  radius?: number
  color?: string
}

export class PointsLayer extends Layer {
  private vertexBuffer: GPUBuffer | null = null
  private points: PointData[] = []
  private vertexCount: number = 0
  private defaultRadius: number = 6
  private defaultColor: string = '#66fcf1'

  constructor(id: string = 'points') {
    super(id)
  }

  setPoints(points: PointData[]): void {
    this.points = points
    if (this.gpu) {
      this.updateBuffers()
    }
  }

  setDefaultRadius(radius: number): void {
    this.defaultRadius = radius
  }

  setDefaultColor(color: string): void {
    this.defaultColor = color
  }

  private updateBuffers(): void {
    if (!this.gpu || this.points.length === 0) return

    // Each point becomes a quad (6 vertices for 2 triangles)
    // Vertex data: x, y, offsetX, offsetY, r, g, b, a, radius
    const floatsPerVertex = 9
    const verticesPerPoint = 6
    const data = new Float32Array(this.points.length * verticesPerPoint * floatsPerVertex)

    const quadOffsets = [
      [-1, -1], [1, -1], [-1, 1],
      [-1, 1], [1, -1], [1, 1]
    ]

    let i = 0
    for (const point of this.points) {
      const color = hexToRgba(point.color || this.defaultColor)
      const radius = point.radius || this.defaultRadius

      for (const [ox, oy] of quadOffsets) {
        data[i++] = point.lng
        data[i++] = point.lat
        data[i++] = ox
        data[i++] = oy
        data[i++] = color[0]
        data[i++] = color[1]
        data[i++] = color[2]
        data[i++] = color[3] * this.opacity
        data[i++] = radius
      }
    }

    this.vertexCount = this.points.length * verticesPerPoint

    // Recreate buffer if needed
    this.vertexBuffer?.destroy()
    this.vertexBuffer = this.gpu.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })
    this.gpu.device.queue.writeBuffer(this.vertexBuffer, 0, data)
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
          @location(1) offset: vec2<f32>,
          @location(2) color: vec4<f32>,
          @location(3) radius: f32,
        }

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
          @location(1) uv: vec2<f32>,
        }

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;

          let worldPos = uniforms.viewMatrix * vec4<f32>(input.position, 0.0, 1.0);
          let pixelOffset = input.offset * input.radius * 0.003;
          output.position = vec4<f32>(worldPos.xy + pixelOffset, worldPos.zw);
          output.color = input.color;
          output.uv = input.offset;

          return output;
        }

        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
          let dist = length(input.uv);
          if (dist > 1.0) {
            discard;
          }
          let alpha = 1.0 - smoothstep(0.7, 1.0, dist);
          return vec4<f32>(input.color.rgb, input.color.a * alpha);
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
          arrayStride: 36, // 9 floats * 4 bytes
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
            { shaderLocation: 1, offset: 8, format: 'float32x2' },  // offset
            { shaderLocation: 2, offset: 16, format: 'float32x4' }, // color
            { shaderLocation: 3, offset: 32, format: 'float32' }    // radius
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
        topology: 'triangle-list'
      }
    })

    this.bindGroup = gpu.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer }
      }]
    })

    // Initialize buffers if we have points
    if (this.points.length > 0) {
      this.updateBuffers()
    }
  }

  render(ctx: LayerRenderContext, passEncoder: GPURenderPassEncoder): void {
    if (!this.visible || !this.pipeline || !this.bindGroup || !this.vertexBuffer || this.vertexCount === 0) {
      return
    }

    // Update view matrix
    ctx.gpu.device.queue.writeBuffer(this.uniformBuffer!, 0, ctx.viewMatrix.buffer)

    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(0, this.bindGroup)
    passEncoder.setVertexBuffer(0, this.vertexBuffer)
    passEncoder.draw(this.vertexCount)
  }

  destroy(): void {
    super.destroy()
    this.vertexBuffer?.destroy()
  }
}
