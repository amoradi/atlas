export { Atlas } from './Atlas'
export { Layer } from './layers/Layer'
export { CountryLayer } from './layers/CountryLayer'
export { themes, getTheme, createTheme, createColorScale, interpolateColor } from './themes'
export type {
  AtlasOptions,
  Theme,
  ThemeName,
  LayerOptions,
  LayerType,
  DataLayerOptions,
  ChoroplethOptions,
  AtlasEvent,
  GeoJSON,
  GeoFeature
} from './core/types'
