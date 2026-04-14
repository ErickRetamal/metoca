import { Platform } from 'react-native'

export const Colors = {
  primary: '#B45309',     // Terracota — acción principal
  success: '#3F7D58',     // Verde salvia — tarea completada
  warning: '#C57B2A',     // Ámbar cálido — tarea pendiente
  danger: '#B84032',      // Rojo arcilla — alerta
  muted: '#A08A7A',       // Marrón suave — elementos secundarios

  background: '#FFF8F1',
  surface: '#FFFFFF',
  border: '#EADFCC',

  text: {
    primary: '#2F241F',
    secondary: '#7A6758',
    inverse: '#FFFFFF',
  },

  // Colores por miembro del hogar (hasta 10)
  members: [
    '#C96B2C', // Terracota
    '#5D8A64', // Salvia
    '#B6493A', // Coral quemado
    '#8F5B3E', // Cobre
    '#6F8C52', // Oliva
    '#A56E45', // Arcilla
    '#8A6B95', // Ciruela suave
    '#4C8A82', // Verde agua cálido
    '#D28E4D', // Miel
    '#7B5A4A', // Café tostado
  ],
} as const

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const BorderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  full: 9999,
} as const

export const LayoutThemes = {
  auth: {
    background: '#2E1A11',
    veil: 'rgba(46, 26, 17, 0.72)',
    frame: 'rgba(244, 220, 195, 0.16)',
    orbPrimary: 'rgba(201, 107, 44, 0.26)',
    orbSecondary: 'rgba(93, 138, 100, 0.2)',
    orbAccent: 'rgba(182, 73, 58, 0.18)',
    statusBar: 'light' as const,
  },
  app: {
    background: '#FFF6EC',
    veil: 'rgba(255, 250, 244, 0.64)',
    frame: 'rgba(180, 128, 90, 0.2)',
    orbPrimary: 'rgba(201, 107, 44, 0.14)',
    orbSecondary: 'rgba(93, 138, 100, 0.12)',
    orbAccent: 'rgba(182, 73, 58, 0.12)',
    statusBar: 'dark' as const,
  },
  swap: {
    background: '#FFF4E8',
    veil: 'rgba(255, 248, 240, 0.66)',
    frame: 'rgba(201, 107, 44, 0.22)',
    orbPrimary: 'rgba(182, 73, 58, 0.14)',
    orbSecondary: 'rgba(93, 138, 100, 0.12)',
    orbAccent: 'rgba(143, 91, 62, 0.12)',
    statusBar: 'dark' as const,
  },
} as const

export const ShadowPresets = {
  card: Platform.select({
    web: { boxShadow: '0px 10px 30px rgba(90, 64, 45, 0.12)' },
    default: {
      shadowColor: '#5A402D',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
  }),
  soft: Platform.select({
    web: { boxShadow: '0px 6px 16px rgba(90, 64, 45, 0.08)' },
    default: {
      shadowColor: '#5A402D',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  }),
  primary: Platform.select({
    web: { boxShadow: '0px 10px 24px rgba(180, 83, 9, 0.3)' },
    default: {
      shadowColor: '#B45309',
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  }),
  danger: Platform.select({
    web: { boxShadow: '0px 10px 24px rgba(184, 64, 50, 0.22)' },
    default: {
      shadowColor: '#B84032',
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  }),
} as const
