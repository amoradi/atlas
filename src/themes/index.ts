import type { Theme, ThemeName } from '../core/types'

export const themes: Record<ThemeName, Theme> = {
  light: {
    background: '#d4c4a8',
    land: '#e8dcc8',
    borders: '#b8a888',
    water: '#c9b896',
    labels: '#5c4a32',
    points: '#8b4513'
  },
  dark: {
    background: '#0b0c10',
    land: '#1f2833',
    borders: '#0f1318',
    water: '#0b0c10',
    labels: '#c5c6c7',
    points: '#66fcf1'
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
