import type { Theme, ThemeName } from '../core/types'

export const themes: Record<ThemeName, Theme> = {
  light: {
    background: '#e6e8e6',
    land: '#f5f5f5',
    borders: '#cccccc',
    water: '#a8d5e5',
    labels: '#333333',
    points: '#e74c3c'
  },
  dark: {
    background: '#1a1a2e',
    land: '#16213e',
    borders: '#0f3460',
    water: '#0a0a0a',
    labels: '#eaeaea',
    points: '#e94560'
  },
  satellite: {
    background: '#0b0c10',
    land: '#1f2833',
    borders: '#45a29e',
    water: '#0b0c10',
    labels: '#c5c6c7',
    points: '#66fcf1'
  },
  minimal: {
    background: '#ffffff',
    land: '#fafafa',
    borders: '#e0e0e0',
    water: '#ffffff',
    labels: '#424242',
    points: '#1976d2'
  }
}

export function getTheme(theme: ThemeName | Theme): Theme {
  if (typeof theme === 'string') {
    return themes[theme] || themes.light
  }
  return theme
}

export function createTheme(overrides: Partial<Theme>): Theme {
  return {
    ...themes.light,
    ...overrides
  }
}

export function interpolateColor(color1: string, color2: string, t: number): string {
  const hex1 = color1.replace('#', '')
  const hex2 = color2.replace('#', '')

  const r1 = parseInt(hex1.substring(0, 2), 16)
  const g1 = parseInt(hex1.substring(2, 4), 16)
  const b1 = parseInt(hex1.substring(4, 6), 16)

  const r2 = parseInt(hex2.substring(0, 2), 16)
  const g2 = parseInt(hex2.substring(2, 4), 16)
  const b2 = parseInt(hex2.substring(4, 6), 16)

  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function createColorScale(colors: string[], steps: number): string[] {
  if (colors.length < 2) return colors

  const result: string[] = []
  const segments = colors.length - 1

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const segment = Math.min(Math.floor(t * segments), segments - 1)
    const localT = (t * segments) - segment
    result.push(interpolateColor(colors[segment], colors[segment + 1], localT))
  }

  return result
}
