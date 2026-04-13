import { Platform } from 'react-native'
import { supabase } from '../supabase'

type NotificationsModule = typeof import('expo-notifications')

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null
let notificationHandlerConfigured = false

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') {
    return null
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications')
  }

  return notificationsModulePromise
}

async function ensureNotificationHandler(): Promise<NotificationsModule | null> {
  const Notifications = await getNotificationsModule()

  if (!Notifications || notificationHandlerConfigured) {
    return Notifications
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })

  notificationHandlerConfigured = true
  return Notifications
}

/**
 * Solicita permiso de notificaciones push al usuario.
 * Retorna true si el permiso fue concedido, false si fue rechazado.
 */
export async function requestPushPermission(): Promise<boolean> {
  const Notifications = await ensureNotificationHandler()
  if (!Notifications) return false

  const { status: existingStatus } = await Notifications.getPermissionsAsync()

  if (existingStatus === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

/**
 * Obtiene el token de push del dispositivo y lo guarda en la base de datos
 * para el usuario autenticado actualmente.
 */
export async function registerPushToken(userId: string): Promise<void> {
  const Notifications = await ensureNotificationHandler()
  if (!Notifications) return

  const permission = await requestPushPermission()
  if (!permission) return

  const tokenData = await Notifications.getExpoPushTokenAsync()
  const token = tokenData.data

  const platform = Platform.OS === 'ios' ? 'ios' : 'android'
  const field = platform === 'ios' ? 'push_token_apns' : 'push_token_fcm'

  await supabase
    .from('users')
    .update({ [field]: token, platform })
    .eq('id', userId)
}

/**
 * Limpia el token de push del usuario (al cerrar sesión).
 */
export async function clearPushToken(userId: string): Promise<void> {
  await supabase
    .from('users')
    .update({ push_token_fcm: null, push_token_apns: null })
    .eq('id', userId)
}
