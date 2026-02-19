export const polygonShader = /* wgsl */ `
  struct Uniforms {
    viewMatrix: mat4x4<f32>,
    color: vec4<f32>,
  }

  @group(0) @binding(0) var<uniform> uniforms: Uniforms;

  struct VertexInput {
    @location(0) position: vec2<f32>,
  }

  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
  }

  @vertex
  fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = uniforms.viewMatrix * vec4<f32>(input.position, 0.0, 1.0);
    return output;
  }

  @fragment
  fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    return uniforms.color;
  }
`

export const lineShader = /* wgsl */ `
  struct Uniforms {
    viewMatrix: mat4x4<f32>,
    color: vec4<f32>,
    lineWidth: f32,
  }

  @group(0) @binding(0) var<uniform> uniforms: Uniforms;

  struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) normal: vec2<f32>,
  }

  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
  }

  @vertex
  fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let offset = input.normal * uniforms.lineWidth * 0.5;
    let pos = input.position + offset;
    output.position = uniforms.viewMatrix * vec4<f32>(pos, 0.0, 1.0);
    return output;
  }

  @fragment
  fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    return uniforms.color;
  }
`

export const pointShader = /* wgsl */ `
  struct Uniforms {
    viewMatrix: mat4x4<f32>,
    color: vec4<f32>,
    pointSize: f32,
  }

  @group(0) @binding(0) var<uniform> uniforms: Uniforms;

  struct VertexInput {
    @location(0) position: vec2<f32>,
    @builtin(vertex_index) vertexIndex: u32,
  }

  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
  }

  @vertex
  fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Create a quad for each point
    let quadOffset = array<vec2<f32>, 6>(
      vec2<f32>(-1.0, -1.0),
      vec2<f32>(1.0, -1.0),
      vec2<f32>(-1.0, 1.0),
      vec2<f32>(-1.0, 1.0),
      vec2<f32>(1.0, -1.0),
      vec2<f32>(1.0, 1.0),
    );

    let localIndex = input.vertexIndex % 6u;
    let offset = quadOffset[localIndex] * uniforms.pointSize;

    let worldPos = uniforms.viewMatrix * vec4<f32>(input.position, 0.0, 1.0);
    output.position = vec4<f32>(worldPos.xy + offset * 0.01, worldPos.zw);
    output.uv = quadOffset[localIndex];

    return output;
  }

  @fragment
  fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // Circular point with antialiased edge
    let dist = length(input.uv);
    if (dist > 1.0) {
      discard;
    }
    let alpha = 1.0 - smoothstep(0.8, 1.0, dist);
    return vec4<f32>(uniforms.color.rgb, uniforms.color.a * alpha);
  }
`

export const choroplethShader = /* wgsl */ `
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
