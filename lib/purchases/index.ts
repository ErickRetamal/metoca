import Purchases, { LOG_LEVEL } from 'react-native-purchases'
import { Platform } from 'react-native'

const REVENUECAT_APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY
const REVENUECAT_GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY

/**
 * Inicializa el SDK de RevenueCat.
 * Debe llamarse al arrancar la app, antes de cualquier operación de compra.
 */
export function initializePurchases(): void {
  if (Platform.OS === 'web') {
    // En web no usamos el SDK móvil de RevenueCat durante pruebas locales.
    return
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG)
  }

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_APPLE_KEY : REVENUECAT_GOOGLE_KEY

  if (!apiKey || apiKey.includes('xxxx')) {
    // Evita crashear la app si la llave aún no está configurada.
    return
  }

  Purchases.configure({ apiKey })
}

/**
 * Asocia el usuario autenticado con RevenueCat.
 * Debe llamarse inmediatamente después del login.
 */
export async function identifyPurchaseUser(userId: string): Promise<void> {
  await Purchases.logIn(userId)
}

/**
 * Desasocia el usuario al cerrar sesión.
 */
export async function resetPurchaseUser(): Promise<void> {
  await Purchases.logOut()
}
