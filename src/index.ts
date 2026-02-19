export { Atlas } from './Atlas'
export { Layer } from './layers/Layer'
export { CountryLayer } from './layers/CountryLayer'
export { PointsLayer, type PointData } from './layers/PointsLayer'
export { ChoroplethLayer, type ChoroplethValue, type ChoroplethOptions } from './layers/ChoroplethLayer'
export { themes, getTheme, createTheme, createColorScale, interpolateColor } from './themes'
export type {
  AtlasOptions,
  Theme,
  ThemeName,
  LayerOptions,
  LayerType,
  DataLayerOptions,
  AtlasEvent,
  GeoJSON,
  GeoFeature
} from './core/types'
