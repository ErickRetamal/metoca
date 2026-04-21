import Purchases, { CustomerInfo, LOG_LEVEL, PURCHASES_ERROR_CODE, PurchasesPackage } from 'react-native-purchases'
import { Platform } from 'react-native'
import { supabase } from '../supabase'
import { SubscriptionPlan } from '../../types'

const REVENUECAT_APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY
const REVENUECAT_GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY

const PRODUCT_PLAN_MAP: Record<string, SubscriptionPlan> = {
  metoca_hogar_monthly: 'hogar',
  metoca_familia_monthly: 'familia',
}

function isNativePurchasesAvailable(): boolean {
  return Platform.OS !== 'web'
}

function resolvePlanFromProductIdentifier(productIdentifier: string | null | undefined): SubscriptionPlan {
  if (!productIdentifier) return 'free'
  if (PRODUCT_PLAN_MAP[productIdentifier]) return PRODUCT_PLAN_MAP[productIdentifier]
  if (productIdentifier.includes('familia')) return 'familia'
  if (productIdentifier.includes('hogar')) return 'hogar'
  return 'free'
}

function resolvePlanFromCustomerInfo(customerInfo: CustomerInfo): SubscriptionPlan {
  const activeEntitlements = Object.values(customerInfo.entitlements.active ?? {})

  for (const entitlement of activeEntitlements) {
    const plan = resolvePlanFromProductIdentifier(entitlement.productIdentifier)
    if (plan !== 'free') return plan
  }

  const activeSubscriptions = customerInfo.activeSubscriptions ?? []
  for (const productId of activeSubscriptions) {
    const plan = resolvePlanFromProductIdentifier(productId)
    if (plan !== 'free') return plan
  }

  return 'free'
}

async function syncRevenueCatSubscription(appUserId?: string): Promise<SubscriptionPlan> {
  const { data, error } = await supabase.functions.invoke('validate-receipt', {
    body: appUserId ? { appUserId } : {},
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data?.plan ?? 'free') as SubscriptionPlan
}

/**
 * Inicializa el SDK de RevenueCat.
 * Debe llamarse al arrancar la app, antes de cualquier operación de compra.
 */
export function initializePurchases(): void {
  if (!isNativePurchasesAvailable()) {
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
  if (!isNativePurchasesAvailable()) return
  await Purchases.logIn(userId)
}

/**
 * Desasocia el usuario al cerrar sesión.
 */
export async function resetPurchaseUser(): Promise<void> {
  if (!isNativePurchasesAvailable()) return
  await Purchases.logOut()
}

export async function getAvailablePurchasePackages(): Promise<PurchasesPackage[]> {
  if (!isNativePurchasesAvailable()) {
    return []
  }

  const offerings = await Purchases.getOfferings()
  return offerings.current?.availablePackages ?? []
}

export async function purchasePlan(plan: SubscriptionPlan): Promise<SubscriptionPlan> {
  if (plan === 'free') {
    return 'free'
  }

  if (!isNativePurchasesAvailable()) {
    throw new Error('Las compras nativas solo están disponibles en iOS y Android.')
  }

  const packages = await getAvailablePurchasePackages()
  const targetPackage = packages.find(pkg => resolvePlanFromProductIdentifier(pkg.product.identifier) === plan)

  if (!targetPackage) {
    throw new Error(`No encontramos un paquete activo de RevenueCat para el plan ${plan}.`)
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(targetPackage)
    const resolvedPlan = resolvePlanFromCustomerInfo(customerInfo)

    if (resolvedPlan === 'free') {
      throw new Error('La compra terminó, pero RevenueCat no reportó un plan activo.')
    }

    await syncRevenueCatSubscription(customerInfo.originalAppUserId)
    return resolvedPlan
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      throw new Error('Compra cancelada.')
    }

    throw error instanceof Error ? error : new Error('No se pudo completar la compra.')
  }
}

export async function restorePurchasesAndSync(): Promise<SubscriptionPlan> {
  if (!isNativePurchasesAvailable()) {
    return 'free'
  }

  const customerInfo = await Purchases.restorePurchases()
  const resolvedPlan = resolvePlanFromCustomerInfo(customerInfo)
  await syncRevenueCatSubscription(customerInfo.originalAppUserId)
  return resolvedPlan
}

export async function refreshPurchasePlan(): Promise<SubscriptionPlan> {
  if (!isNativePurchasesAvailable()) {
    return 'free'
  }

  const customerInfo = await Purchases.getCustomerInfo()
  const resolvedPlan = resolvePlanFromCustomerInfo(customerInfo)
  await syncRevenueCatSubscription(customerInfo.originalAppUserId)
  return resolvedPlan
}
