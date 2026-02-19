export interface AtlasOptions {
  container: string | HTMLElement
  theme?: ThemeName | Theme
  center?: [number, number] // [lng, lat]
  zoom?: number
  minZoom?: number
  maxZoom?: number
  countries?: string | boolean // URL or true for default Natural Earth 110m
}

export type ThemeName = 'light' | 'dark'

export interface Theme {
  background: string
  land: string
  borders: string
  water: string
  labels: string
  points: string
}

export interface LayerOptions {
  type: LayerType
  data?: unknown
  visible?: boolean
  opacity?: number
}

export type LayerType =
  | 'countries'
  | 'borders'
  | 'regions'
  | 'points'
  | 'heatmap'
  | 'choropleth'
  | 'bubbles'
  | 'pulses'
  | 'lines'

export interface DataLayerOptions<T = unknown> extends LayerOptions {
  data: T[]
  lat: (d: T) => number
  lng: (d: T) => number
  radius?: number | ((d: T) => number)
  color?: string | ((d: T) => string)
  value?: (d: T) => number
}

export interface ChoroplethOptions<T = unknown> extends LayerOptions {
  data: T[]
  key: (d: T) => string // Country code or name
  value: (d: T) => number
  colors?: [string, string] // [min, max] gradient
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

export interface AtlasEvent {
  type: string
  lngLat: [number, number]
  pixel: [number, number]
  country?: string
  feature?: GeoFeature
}

export interface GeoFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export interface GeoJSON {
  type: 'FeatureCollection'
  features: GeoFeature[]
}
