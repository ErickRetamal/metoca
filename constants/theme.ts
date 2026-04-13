import { Platform } from 'react-native'

export const Colors = {
  primary: '#4F46E5',     // Indigo — acción principal
  success: '#16A34A',     // Verde — tarea completada
  warning: '#D97706',     // Amarillo — tarea pendiente
  danger: '#DC2626',      // Rojo — tarea missed / alerta
  muted: '#9CA3AF',       // Gris — elementos secundarios

  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',

  text: {
    primary: '#111827',
    secondary: '#6B7280',
    inverse: '#FFFFFF',
  },

  // Colores por miembro del hogar (hasta 10)
  members: [
    '#4F46E5', // Indigo
    '#0891B2', // Cyan
    '#16A34A', // Verde
    '#D97706', // Naranja
    '#DC2626', // Rojo
    '#7C3AED', // Violeta
    '#DB2777', // Rosa
    '#65A30D', // Lima
    '#0284C7', // Azul
    '#9D174D', // Fucsia
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
    background: '#07111F',
    veil: 'rgba(8, 15, 30, 0.78)',
    frame: 'rgba(148, 163, 184, 0.14)',
    orbPrimary: 'rgba(37, 99, 235, 0.24)',
    orbSecondary: 'rgba(20, 184, 166, 0.18)',
    orbAccent: 'rgba(124, 58, 237, 0.16)',
    statusBar: 'light' as const,
  },
  app: {
    background: '#F4F7FB',
    veil: 'rgba(255, 255, 255, 0.58)',
    frame: 'rgba(148, 163, 184, 0.2)',
    orbPrimary: 'rgba(79, 70, 229, 0.12)',
    orbSecondary: 'rgba(14, 165, 164, 0.1)',
    orbAccent: 'rgba(234, 88, 12, 0.1)',
    statusBar: 'dark' as const,
  },
  swap: {
    background: '#F2F7FF',
    veil: 'rgba(255, 255, 255, 0.62)',
    frame: 'rgba(125, 211, 252, 0.24)',
    orbPrimary: 'rgba(14, 116, 144, 0.12)',
    orbSecondary: 'rgba(37, 99, 235, 0.12)',
    orbAccent: 'rgba(16, 185, 129, 0.1)',
    statusBar: 'dark' as const,
  },
} as const

export const ShadowPresets = {
  card: Platform.select({
    web: { boxShadow: '0px 10px 30px rgba(15, 23, 42, 0.08)' },
    default: {
      shadowColor: '#111827',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
  }),
  soft: Platform.select({
    web: { boxShadow: '0px 6px 16px rgba(15, 23, 42, 0.05)' },
    default: {
      shadowColor: '#111827',
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  }),
  primary: Platform.select({
    web: { boxShadow: '0px 10px 24px rgba(30, 58, 138, 0.22)' },
    default: {
      shadowColor: '#1E3A8A',
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  }),
  danger: Platform.select({
    web: { boxShadow: '0px 10px 24px rgba(220, 38, 38, 0.18)' },
    default: {
      shadowColor: '#DC2626',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  }),
} as const
