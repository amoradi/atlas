export interface GPUContext {
  device: GPUDevice
  context: GPUCanvasContext
  format: GPUTextureFormat
  canvas: HTMLCanvasElement
}

export async function initWebGPU(canvas: HTMLCanvasElement): Promise<GPUContext> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser')
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  })

  if (!adapter) {
    throw new Error('Failed to get WebGPU adapter')
  }

  const device = await adapter.requestDevice()

  const context = canvas.getContext('webgpu')
  if (!context) {
    throw new Error('Failed to get WebGPU context')
  }

  const format = navigator.gpu.getPreferredCanvasFormat()

  context.configure({
    device,
    format,
    alphaMode: 'premultiplied'
  })

  return { device, context, format, canvas }
}

export function hexToRgba(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    return [0, 0, 0, 1]
  }
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
    1
  ]
}

export function createBuffer(
  device: GPUDevice,
  data: Float32Array | Uint32Array,
  usage: GPUBufferUsageFlags
): GPUBuffer {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage,
    mappedAtCreation: true
  })

  if (data instanceof Float32Array) {
    new Float32Array(buffer.getMappedRange()).set(data)
  } else {
    new Uint32Array(buffer.getMappedRange()).set(data)
  }

  buffer.unmap()
  return buffer
}
