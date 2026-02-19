# Atlas

A lightweight WebGPU-powered world map renderer.

## Features

- **WebGPU rendering** — fast, GPU-accelerated map drawing
- **Pan & zoom** — smooth trackpad and mouse controls
- **Themes** — light and dark modes with customizable colors
- **Choropleth** — color countries by data values (GDP, population, etc.)
- **Points layer** — render markers at coordinates
- **TypeScript** — full type definitions included

## Installation

```bash
npm install atlas
```

## Quick Start

```ts
import { Atlas } from 'atlas'

const map = new Atlas({
  container: '#map',
  countries: true  // loads Natural Earth 110m
})

map.on('click', (e) => {
  console.log('Clicked:', e.lngLat)
})
```

Or with a custom GeoJSON URL:

```ts
const map = new Atlas({
  container: '#map',
  countries: 'https://example.com/countries.geojson'
})
```

## Choropleth Layer

Color countries by value:

```ts
await map.addChoroplethLayer('gdp', gdpData, {
  geoJsonUrl: 'countries.geojson',
  colors: ['#2a3a45', '#4a6868'],
  defaultColor: '#2a3a45'
})

// Update data dynamically
map.updateChoropleth('gdp', newData)
```

## Points Layer

Add markers:

```ts
await map.addPointsLayer('cities', [
  { lng: -74.006, lat: 40.7128, radius: 8, color: '#ff6b6b' },
  { lng: 139.6917, lat: 35.6895, radius: 6, color: '#4ecdc4' },
])

// Update points
map.updatePoints('cities', newPoints)
```

## API

### `new Atlas(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | `string \| HTMLElement` | required | Container element or selector |
| `theme` | `'light' \| 'dark' \| Theme` | `'dark'` | Color theme |
| `center` | `[lng, lat]` | `[0, 0]` | Initial center |
| `zoom` | `number` | `1` | Initial zoom level |

### Methods

- `setTheme(theme)` — change theme
- `setCenter(lng, lat)` — pan to location
- `setZoom(level)` — set zoom level
- `getCenter()` — get current center
- `getZoom()` — get current zoom
- `on(event, callback)` — listen for events
- `off(event, callback)` — remove listener
- `refresh()` — force re-render
- `destroy()` — clean up resources

### Events

- `click` — fired on map click, includes `lngLat` and `pixel` coordinates

## Custom Themes

```ts
const map = new Atlas({
  container: '#map',
  theme: {
    background: '#1a1a2e',
    land: '#16213e',
    borders: '#0f3460',
    water: '#0a0a0a',
    labels: '#eaeaea',
    points: '#e94560'
  }
})
```

## Browser Support

Requires WebGPU support. Currently available in:
- Chrome 113+
- Edge 113+
- Firefox (behind flag)
- Safari 17+ (macOS Sonoma)

## Development

```bash
npm install
npm run dev     # Start dev server
npm run build   # Build for production
```

## License

MIT
