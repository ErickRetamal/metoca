import { useEffect, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { BorderRadius, Colors, ShadowPresets, Spacing } from '../../../constants/theme'
import { Reveal } from '../../../components/ui/reveal'
import { Skeleton } from '../../../components/ui/skeleton'
import { HamburgerButton } from '../../../components/dashboard/side-menu'
import { useMenuContext } from '../../../lib/menu-context'
import { supabase } from '../../../lib/supabase'
import { getCurrentPlanAsync } from '../../../lib/dashboard'
import { goToPaywall } from '../../../lib/navigation'

type AppPlan = 'free' | 'hogar' | 'familia'
type TaskFrequency = 'daily' | 'weekly' | 'monthly'
type TaskAudience = 'todos' | 'solo_adultos' | 'solo_jovenes'

interface WeeklySlotDraft {
  id: string
  daysOfWeek: number[]
  timeDraft: string
}

interface TaskTemplate {
  key: string
  name: string
  code: string
  color: string
  frequency: TaskFrequency
  notificationTime: string
  dayOfWeek?: number
  dayOfMonth?: number
}

const WEEK_DAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mie' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sab' },
]

const TASK_AUDIENCE_OPTIONS: Array<{ value: TaskAudience; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'solo_adultos', label: 'Solo adultos' },
  { value: 'solo_jovenes', label: 'Solo jóvenes' },
]

const TASK_TEMPLATES: TaskTemplate[] = [
  { key: 'dishes', name: 'Lavar platos', code: 'LP', color: '#FCE8D9', frequency: 'daily', notificationTime: '20:00:00' },
  { key: 'trash', name: 'Sacar basura', code: 'SB', color: '#F7E4DB', frequency: 'daily', notificationTime: '21:00:00' },
  { key: 'sweep', name: 'Barrer piso', code: 'BP', color: '#FBE7DE', frequency: 'daily', notificationTime: '19:00:00' },
  { key: 'bathroom', name: 'Limpiar bano', code: 'LB', color: '#F6EBDD', frequency: 'weekly', notificationTime: '10:00:00', dayOfWeek: 6 },
  { key: 'laundry', name: 'Lavar ropa', code: 'LR', color: '#E8F0E6', frequency: 'weekly', notificationTime: '11:00:00', dayOfWeek: 3 },
  { key: 'kitchen', name: 'Orden cocina', code: 'OC', color: '#FFF1E4', frequency: 'daily', notificationTime: '18:30:00' },
  { key: 'beds', name: 'Hacer camas', code: 'HC', color: '#F9EED0', frequency: 'daily', notificationTime: '08:00:00' },
  { key: 'plants', name: 'Regar plantas', code: 'RP', color: '#EAF3E8', frequency: 'weekly', notificationTime: '09:00:00', dayOfWeek: 2 },
  { key: 'fridge', name: 'Revisar refri', code: 'RR', color: '#F6EDE8', frequency: 'weekly', notificationTime: '20:30:00', dayOfWeek: 0 },
  { key: 'dust', name: 'Quitar polvo', code: 'QP', color: '#F3ECE6', frequency: 'weekly', notificationTime: '12:00:00', dayOfWeek: 5 },
  { key: 'windows', name: 'Limpiar vidrios', code: 'LV', color: '#EEE5D9', frequency: 'monthly', notificationTime: '10:30:00', dayOfMonth: 10 },
  { key: 'pantry', name: 'Orden despensa', code: 'OD', color: '#F6ECD4', frequency: 'monthly', notificationTime: '17:00:00', dayOfMonth: 12 },
  { key: 'garage', name: 'Orden garage', code: 'OG', color: '#F6DFD7', frequency: 'monthly', notificationTime: '16:00:00', dayOfMonth: 15 },
  { key: 'shopping', name: 'Lista compras', code: 'LC', color: '#EFE8E1', frequency: 'weekly', notificationTime: '18:00:00', dayOfWeek: 4 },
  { key: 'bathsupplies', name: 'Reponer bano', code: 'RB', color: '#EAF1DE', frequency: 'weekly', notificationTime: '13:00:00', dayOfWeek: 1 },
  { key: 'pet', name: 'Zona mascota', code: 'ZM', color: '#F8E7E3', frequency: 'daily', notificationTime: '19:30:00' },
]

function getCustomTaskLimit(plan: AppPlan): number {
  if (plan === 'hogar') return 5
  if (plan === 'familia') return 30
  return 0
}

function normalizeTimeInput(value: string): string {
  const cleaned = value.replace(/[^0-9:]/g, '').slice(0, 5)
  const parts = cleaned.split(':')
  if (parts.length === 1) return parts[0]
  const hh = parts[0]?.slice(0, 2) ?? ''
  const mm = parts[1]?.slice(0, 2) ?? ''
  return `${hh}${cleaned.includes(':') ? ':' : ''}${mm}`
}

function toTimeWithSeconds(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

function clampDayOfMonth(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return 1
  return Math.max(1, Math.min(28, parsed))
}

function toggleWeekDay(current: number[], day: number): number[] {
  if (current.includes(day)) {
    const next = current.filter(value => value !== day)
    return next.length > 0 ? next : current
  }
  return [...current, day].sort((a, b) => a - b)
}

function createWeeklySlotDraft(): WeeklySlotDraft {
  return {
    id: `slot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    daysOfWeek: [1],
    timeDraft: '20:00',
  }
}

export default function ConfigureHouseholdTasksScreen() {
  const { onMenuPress } = useMenuContext()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [redistributing, setRedistributing] = useState(false)
  const [plan, setPlan] = useState<AppPlan>('free')
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [selectedTaskNames, setSelectedTaskNames] = useState<string[]>([])
  const [customTasks, setCustomTasks] = useState<Array<{ id: string; name: string; frequency: TaskFrequency; audience: TaskAudience }>>([])
  const [activeTasks, setActiveTasks] = useState<Array<{ id: string; name: string; frequency: TaskFrequency; audience: TaskAudience; isCustom: boolean }>>([])

  const [templateToActivate, setTemplateToActivate] = useState<TaskTemplate | null>(null)
  const [templateFrequency, setTemplateFrequency] = useState<TaskFrequency>('daily')
  const [templateAudience, setTemplateAudience] = useState<TaskAudience>('todos')
  const [templateTimeDraft, setTemplateTimeDraft] = useState('20:00')
  const [templateDaysOfWeek, setTemplateDaysOfWeek] = useState<number[]>([1])
  const [templateDayOfMonth, setTemplateDayOfMonth] = useState(1)
  const [templateExtraWeeklySlots, setTemplateExtraWeeklySlots] = useState<WeeklySlotDraft[]>([])

  const [customTaskNameDraft, setCustomTaskNameDraft] = useState('')
  const [customTaskFrequency, setCustomTaskFrequency] = useState<TaskFrequency>('weekly')
  const [customTaskAudience, setCustomTaskAudience] = useState<TaskAudience>('todos')
  const [customTaskTimeDraft, setCustomTaskTimeDraft] = useState('20:00')
  const [customTaskDaysOfWeek, setCustomTaskDaysOfWeek] = useState<number[]>([1])
  const [customTaskDayOfMonth, setCustomTaskDayOfMonth] = useState(1)
  const [customExtraWeeklySlots, setCustomExtraWeeklySlots] = useState<WeeklySlotDraft[]>([])
  const [screenFeedback, setScreenFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function getCurrentMonthKey(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (mounted) router.replace('/(auth)/welcome')
          return
        }

        const [nextPlan, membership] = await Promise.all([
          getCurrentPlanAsync(),
          supabase
            .from('household_members')
            .select('household_id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle(),
        ])

        if (!mounted) return
        setCurrentUserId(user.id)
        setPlan(nextPlan)

        const nextHouseholdId = membership.data?.household_id ?? null
        setHouseholdId(nextHouseholdId)

        if (!nextHouseholdId) {
          setIsAdmin(false)
          setSelectedTaskNames([])
          setCustomTasks([])
          return
        }

        const [{ data: householdRow }, { data: taskRows }] = await Promise.all([
          supabase
            .from('households')
            .select('admin_user_id')
            .eq('id', nextHouseholdId)
            .maybeSingle(),
          supabase
            .from('tasks')
            .select('id, name, frequency, audience')
            .eq('household_id', nextHouseholdId)
            .eq('is_active', true)
            .is('deleted_at', null),
        ])

        if (!mounted) return

        const names = (taskRows ?? []).map((row: any) => row.name)
        const templateNameSet = new Set(TASK_TEMPLATES.map(template => template.name))
        const loadedCustom = (taskRows ?? [])
          .filter((row: any) => !templateNameSet.has(row.name))
          .map((row: any) => ({
            id: row.id,
            name: row.name,
            frequency: row.frequency as TaskFrequency,
            audience: (row.audience ?? 'todos') as TaskAudience,
          }))

        const adminAccess = Boolean(householdRow?.admin_user_id && householdRow.admin_user_id === user.id)

        const allActiveTasks = (taskRows ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          frequency: row.frequency as TaskFrequency,
          audience: (row.audience ?? 'todos') as TaskAudience,
          isCustom: !templateNameSet.has(row.name),
        }))

        setSelectedTaskNames(names)
        setCustomTasks(loadedCustom)
        setActiveTasks(allActiveTasks)
        setIsAdmin(adminAccess)

        if (!adminAccess) {
          const message = 'Solo el jefe de hogar puede configurar tareas.'
          if (Platform.OS === 'web') {
            ;(globalThis as any).alert?.(message)
          } else {
            Alert.alert('Acceso restringido', message)
          }
          router.replace('/(app)/household')
          return
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      mounted = false
    }
  }, [])

  const isProPlan = plan !== 'free'
  const availableTemplates = TASK_TEMPLATES.filter(template => !selectedTaskNames.includes(template.name))

  async function persistExtraWeeklySlots(taskId: string, frequency: TaskFrequency, slots: WeeklySlotDraft[]) {
    if (!householdId) return

    const normalized: Array<{ task_id: string; household_id: string; frequency: TaskFrequency; notification_time: string; day_of_week: number | null; weekly_days: number[] | null }> = []

    for (const slot of slots) {
      const timeWithSeconds = toTimeWithSeconds(slot.timeDraft)
      if (!timeWithSeconds) {
        throw new Error('Usa formato HH:MM en los bloques de horario adicionales.')
      }
      if (frequency === 'weekly' && slot.daysOfWeek.length === 0) {
        throw new Error('Selecciona al menos un día por cada bloque adicional.')
      }

      normalized.push({
        task_id: taskId,
        household_id: householdId,
        frequency,
        notification_time: timeWithSeconds,
        day_of_week: frequency === 'weekly' ? slot.daysOfWeek[0] : null,
        weekly_days: frequency === 'weekly' ? slot.daysOfWeek : null,
      })
    }

    const { error: deleteError } = await supabase
      .from('task_schedules')
      .delete()
      .eq('task_id', taskId)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    if (normalized.length === 0) return

    const { error: insertError } = await supabase
      .from('task_schedules')
      .insert(normalized)

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  async function handleActivateTemplate() {
    if (!householdId || !currentUserId || !templateToActivate || !isAdmin) return

    setScreenFeedback(null)

    const notificationTime = toTimeWithSeconds(templateTimeDraft)
    if (!notificationTime) {
      Alert.alert('Horario inválido', 'Usa formato HH:MM, por ejemplo 20:00.')
      return
    }

    const nextWeeklyDays = templateFrequency === 'weekly' ? templateDaysOfWeek : []
    if (templateFrequency === 'weekly' && nextWeeklyDays.length === 0) {
      Alert.alert('Días requeridos', 'Selecciona al menos un día para la tarea semanal.')
      return
    }

    const nextDayOfWeek = templateFrequency === 'weekly' ? nextWeeklyDays[0] : null
    const nextDayOfMonth = templateFrequency === 'monthly' ? clampDayOfMonth(String(templateDayOfMonth)) : null

    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('household_id', householdId)
        .eq('name', templateToActivate.name)
        .limit(1)

      const taskId = existing && existing.length > 0 ? existing[0].id : null

      if (taskId) {
        const { error } = await supabase
          .from('tasks')
          .update({
            is_active: true,
            deleted_at: null,
            frequency: templateFrequency,
            audience: isProPlan ? templateAudience : 'todos',
            is_custom: false,
            notification_time: notificationTime,
            day_of_week: nextDayOfWeek,
            weekly_days: templateFrequency === 'weekly' ? nextWeeklyDays : null,
            day_of_month: nextDayOfMonth,
          })
          .eq('id', taskId)

        if (error) {
          setScreenFeedback({ type: 'error', message: error.message })
          Alert.alert('Error', error.message)
          return
        }

        await persistExtraWeeklySlots(
          taskId,
          templateFrequency,
          templateFrequency === 'weekly' || templateFrequency === 'daily' ? templateExtraWeeklySlots : []
        )
        setActiveTasks(prev => [
          ...prev.filter(t => t.name !== templateToActivate.name),
          { id: taskId, name: templateToActivate.name, frequency: templateFrequency, audience: isProPlan ? templateAudience : 'todos', isCustom: false },
        ])
      } else {
        const { data: inserted, error } = await supabase
          .from('tasks')
          .insert({
            household_id: householdId,
            name: templateToActivate.name,
            frequency: templateFrequency,
            audience: isProPlan ? templateAudience : 'todos',
            is_custom: false,
            notification_time: notificationTime,
            day_of_week: nextDayOfWeek,
            weekly_days: templateFrequency === 'weekly' ? nextWeeklyDays : null,
            day_of_month: nextDayOfMonth,
            created_by: currentUserId,
            is_active: true,
          })
          .select('id')
          .single()

        if (error) {
          setScreenFeedback({ type: 'error', message: error.message })
          Alert.alert('Error', error.message)
          return
        }

        await persistExtraWeeklySlots(
          inserted.id,
          templateFrequency,
          templateFrequency === 'weekly' || templateFrequency === 'daily' ? templateExtraWeeklySlots : []
        )
        setActiveTasks(prev => [
          ...prev.filter(t => t.name !== templateToActivate.name),
          { id: inserted.id, name: templateToActivate.name, frequency: templateFrequency, audience: isProPlan ? templateAudience : 'todos', isCustom: false },
        ])
      }

      setSelectedTaskNames(prev => [...prev, templateToActivate.name])
      setScreenFeedback({ type: 'success', message: `"${templateToActivate.name}" quedó activa.` })
      setTemplateToActivate(null)
      setTemplateExtraWeeklySlots([])
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCustomTask() {
    if (!householdId || !currentUserId || !isAdmin) return

    setScreenFeedback(null)

    if (plan === 'free') {
      Alert.alert(
        'Plan Free',
        'En Free solo puedes usar tareas fijas. Actualiza a Hogar o Familia para crear nuevas tareas.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver planes', onPress: () => goToPaywall('household-free-alert') },
        ]
      )
      return
    }

    const taskName = customTaskNameDraft.trim()
    if (!taskName) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para la tarea personalizada.')
      return
    }

    const lowerName = taskName.toLowerCase()
    if (selectedTaskNames.some(name => name.toLowerCase() === lowerName)) {
      Alert.alert('Ya existe', 'Esa tarea ya está activa en el hogar.')
      return
    }

    const maxCustom = getCustomTaskLimit(plan)
    if (customTasks.length >= maxCustom) {
      Alert.alert('Límite alcanzado', `Tu plan actual permite hasta ${maxCustom} tareas personalizadas activas.`)
      return
    }

    const notificationTime = toTimeWithSeconds(customTaskTimeDraft)
    if (!notificationTime) {
      Alert.alert('Horario inválido', 'Usa formato HH:MM, por ejemplo 20:00.')
      return
    }

    const nextCustomWeeklyDays = customTaskFrequency === 'weekly' ? customTaskDaysOfWeek : []
    if (customTaskFrequency === 'weekly' && nextCustomWeeklyDays.length === 0) {
      Alert.alert('Días requeridos', 'Selecciona al menos un día para la tarea semanal.')
      return
    }

    const nextDayOfWeek = customTaskFrequency === 'weekly' ? nextCustomWeeklyDays[0] : null
    const nextDayOfMonth = customTaskFrequency === 'monthly' ? clampDayOfMonth(String(customTaskDayOfMonth)) : null

    setSaving(true)
    try {
      const { data: inserted, error } = await supabase
        .from('tasks')
        .insert({
          household_id: householdId,
          name: taskName,
          frequency: customTaskFrequency,
          audience: isProPlan ? customTaskAudience : 'todos',
          is_custom: true,
          notification_time: notificationTime,
          day_of_week: nextDayOfWeek,
          weekly_days: customTaskFrequency === 'weekly' ? nextCustomWeeklyDays : null,
          day_of_month: nextDayOfMonth,
          created_by: currentUserId,
          is_active: true,
        })
        .select('id')
        .single()

      if (error) {
        setScreenFeedback({ type: 'error', message: error.message })
        Alert.alert('Error', error.message)
        return
      }

      await persistExtraWeeklySlots(
        inserted.id,
        customTaskFrequency,
        customTaskFrequency === 'weekly' || customTaskFrequency === 'daily' ? customExtraWeeklySlots : []
      )

      setSelectedTaskNames(prev => [...prev, taskName])
      setCustomTasks(prev => [...prev, { id: inserted.id, name: taskName, frequency: customTaskFrequency, audience: isProPlan ? customTaskAudience : 'todos' }])
      setActiveTasks(prev => [...prev, { id: inserted.id, name: taskName, frequency: customTaskFrequency, audience: isProPlan ? customTaskAudience : 'todos', isCustom: true }])
      setCustomTaskNameDraft('')
      setCustomTaskFrequency('weekly')
      setCustomTaskAudience('todos')
      setCustomTaskTimeDraft('20:00')
      setCustomTaskDaysOfWeek([1])
      setCustomTaskDayOfMonth(1)
      setCustomExtraWeeklySlots([])
      setScreenFeedback({ type: 'success', message: `Tarea "${taskName}" agregada correctamente.` })
    } finally {
      setSaving(false)
    }
  }

  async function handleRedistributeTasksNow() {
    if (!householdId || !isAdmin || redistributing) return

    if (plan === 'free') {
      Alert.alert(
        'Plan Free',
        'La redistribución manual con perfiles está disponible en Hogar o Familia. En Free se mantiene la distribución normal.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver planes', onPress: () => goToPaywall('configure-tasks-free-redistribute') },
        ]
      )
      return
    }

    setScreenFeedback(null)

    setRedistributing(true)
    try {
      const currentMonth = getCurrentMonthKey()
      const { data, error } = await supabase.rpc('redistribute_household_tasks', {
        p_household_id: householdId,
        p_month: currentMonth,
      })

      if (error) {
        const msg = (error.message ?? '').toLowerCase()
        if (msg.includes('only_admin_can_redistribute')) {
          setScreenFeedback({ type: 'error', message: 'Solo el jefe de hogar puede redistribuir tareas.' })
          Alert.alert('Solo admin', 'Solo el jefe de hogar puede redistribuir tareas.')
          return
        }
        if (msg.includes('no_active_members')) {
          setScreenFeedback({ type: 'error', message: 'No hay miembros activos para distribuir tareas.' })
          Alert.alert('Sin miembros', 'No hay miembros activos para distribuir tareas.')
          return
        }
        setScreenFeedback({ type: 'error', message: error.message })
        Alert.alert('Error al redistribuir', error.message)
        return
      }

      const created = Number((data as any)?.executions_created ?? 0)
      const moved = Number((data as any)?.pending_reassigned ?? 0)

      setScreenFeedback({
        type: 'success',
        message: `OK. Pendientes reasignadas: ${moved}. Nuevas ejecuciones: ${created}.`,
      })
    } finally {
      setRedistributing(false)
    }
  }

  async function handleDeactivateTask(taskId: string, taskName: string) {
    if (!householdId || !isAdmin || saving) return

    const performDeactivate = async () => {
      setSaving(true)
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ is_active: false, deleted_at: new Date().toISOString() })
          .eq('id', taskId)
          .eq('household_id', householdId)

        if (error) {
          setScreenFeedback({ type: 'error', message: error.message })
          if (Platform.OS === 'web') {
            ;(globalThis as any).alert?.(`Error: ${error.message}`)
          } else {
            Alert.alert('Error', error.message)
          }
          return
        }

        const todayKey = new Date().toISOString().slice(0, 10)
        await supabase
          .from('task_executions')
          .update({ status: 'missed' })
          .eq('task_id', taskId)
          .eq('status', 'pending')
          .gte('scheduled_date', todayKey)

        setActiveTasks(prev => prev.filter(t => t.id !== taskId))
        setSelectedTaskNames(prev => prev.filter(n => n !== taskName))
        setCustomTasks(prev => prev.filter(t => t.id !== taskId))
        setScreenFeedback({ type: 'success', message: `"${taskName}" eliminada.` })
      } finally {
        setSaving(false)
      }
    }

    if (Platform.OS === 'web') {
      const confirmed = (globalThis as any).confirm?.(
        `¿Eliminar "${taskName}" del hogar? Esto la desactivará para todos los miembros.`
      )
      if (confirmed) {
        await performDeactivate()
      }
      return
    }

    Alert.alert(
      'Eliminar tarea',
      `¿Eliminar "${taskName}" del hogar? Esto la desactivará para todos los miembros.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void performDeactivate()
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerCard}>
            <Skeleton width={145} height={14} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width={220} height={34} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="75%" height={16} />
          </View>

          <View style={styles.card}>
            <Skeleton width="52%" height={22} style={{ marginBottom: Spacing.md }} />
            <Skeleton width="100%" height={42} />
          </View>

          <View style={styles.card}>
            <Skeleton width="58%" height={22} style={{ marginBottom: Spacing.md }} />
            <Skeleton width="100%" height={120} />
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal>
          <View style={styles.headerCard}>
            <View style={styles.headerMenuRow}>
              <HamburgerButton onPress={onMenuPress} />
              <Text style={styles.eyebrow}>Configuración</Text>
            </View>
            <Text style={styles.title}>Asignar nuevas tareas</Text>
            <Text style={styles.subtitle}>Activa tareas fijas o crea personalizadas según tu plan.</Text>
          </View>
        </Reveal>

        {screenFeedback && (
          <View style={[styles.feedbackBox, screenFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
            <Text style={[styles.feedbackText, screenFeedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError]}>
              {screenFeedback.message}
            </Text>
          </View>
        )}

        {!householdId && (
          <View style={styles.card}>
            <Text style={styles.cardSubtitle}>No estás en un hogar activo. Únete o crea uno primero.</Text>
          </View>
        )}

        {householdId && !isAdmin && (
          <View style={styles.card}>
            <Text style={styles.cardSubtitle}>Solo el jefe de hogar puede asignar nuevas tareas.</Text>
          </View>
        )}

        {householdId && isAdmin && (
          <>
            <Reveal delay={70}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Distribución de tareas</Text>
                <Text style={styles.cardSubtitle}>
                  Úsalo cuando entre un miembro nuevo o cuando quieras redistribuir antes del automático del día 15.
                </Text>
                <Pressable
                  style={[styles.primaryButton, redistributing && styles.buttonDisabled]}
                  onPress={handleRedistributeTasksNow}
                  disabled={redistributing}
                >
                  <Text style={styles.primaryButtonText}>
                    {redistributing ? 'Redistribuyendo...' : 'Redistribuir tareas ahora'}
                  </Text>
                </Pressable>
              </View>
            </Reveal>

            <Reveal delay={80}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Tareas activas ({activeTasks.length})</Text>
                {activeTasks.length === 0 ? (
                  <Text style={styles.cardSubtitle}>No hay tareas activas aún.</Text>
                ) : (
                  <View style={styles.activeTaskList}>
                    {activeTasks.map(task => (
                      <View key={task.id} style={styles.activeTaskRow}>
                        <View style={styles.activeTaskInfo}>
                          <Text style={styles.activeTaskName}>{task.name}</Text>
                          <Text style={styles.activeTaskMeta}>
                            {task.frequency === 'daily' ? 'Diaria' : task.frequency === 'weekly' ? 'Semanal' : 'Mensual'}
                            {task.isCustom ? ' · Personalizada' : ''}
                          </Text>
                        </View>
                        <Pressable
                          style={[styles.deactivateButton, saving && styles.buttonDisabled]}
                          onPress={() => handleDeactivateTask(task.id, task.name)}
                          disabled={saving}
                        >
                          <Text style={styles.deactivateButtonText}>Eliminar</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Reveal>

            <Reveal delay={90}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Tareas fijas disponibles</Text>
                {availableTemplates.length === 0 ? (
                  <Text style={styles.cardSubtitle}>Todas las tareas fijas ya están activas.</Text>
                ) : (
                  <View style={styles.templateGrid}>
                    {availableTemplates.map(template => (
                      <Pressable
                        key={template.key}
                        style={[styles.templateCard, saving && styles.templateCardDisabled]}
                        onPress={() => {
                          setTemplateToActivate(template)
                          setTemplateFrequency(template.frequency)
                          setTemplateAudience('todos')
                          setTemplateTimeDraft(template.notificationTime.slice(0, 5))
                          setTemplateDaysOfWeek(template.dayOfWeek != null ? [template.dayOfWeek] : [1])
                          setTemplateDayOfMonth(template.dayOfMonth ?? 1)
                          setTemplateExtraWeeklySlots([])
                        }}
                        disabled={saving}
                      >
                        <View style={[styles.templateThumb, { backgroundColor: template.color }]}> 
                          <Text style={styles.templateThumbText}>{template.code}</Text>
                        </View>
                        <Text style={styles.templateName} numberOfLines={2}>{template.name}</Text>
                        <Text style={styles.templateMeta}>Agregar</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </Reveal>

            {templateToActivate && (
              <Reveal delay={110}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Configurar "{templateToActivate.name}"</Text>

                  <View style={styles.frequencyRow}>
                    <Pressable style={[styles.frequencyChip, templateFrequency === 'daily' && styles.frequencyChipActive]} onPress={() => setTemplateFrequency('daily')}>
                      <Text style={[styles.frequencyChipText, templateFrequency === 'daily' && styles.frequencyChipTextActive]}>Diaria</Text>
                    </Pressable>
                    <Pressable style={[styles.frequencyChip, templateFrequency === 'weekly' && styles.frequencyChipActive]} onPress={() => setTemplateFrequency('weekly')}>
                      <Text style={[styles.frequencyChipText, templateFrequency === 'weekly' && styles.frequencyChipTextActive]}>Semanal</Text>
                    </Pressable>
                    <Pressable style={[styles.frequencyChip, templateFrequency === 'monthly' && styles.frequencyChipActive]} onPress={() => setTemplateFrequency('monthly')}>
                      <Text style={[styles.frequencyChipText, templateFrequency === 'monthly' && styles.frequencyChipTextActive]}>Mensual</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.infoLabel}>Audiencia</Text>
                  <View style={styles.frequencyRow}>
                    {TASK_AUDIENCE_OPTIONS.map(option => (
                      <Pressable
                        key={option.value}
                        style={[styles.frequencyChip, templateAudience === option.value && styles.frequencyChipActive]}
                        onPress={() => setTemplateAudience(option.value)}
                        disabled={!isProPlan}
                      >
                        <Text style={[styles.frequencyChipText, templateAudience === option.value && styles.frequencyChipTextActive]}>{option.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {!isProPlan && <Text style={styles.cardSubtitle}>En Free la audiencia siempre es “Todos”.</Text>}

                  {templateFrequency === 'weekly' && (
                    <>
                      <View style={styles.dayChipsRow}>
                        {WEEK_DAY_OPTIONS.map(day => (
                          <Pressable
                            key={day.value}
                            style={[styles.dayChip, templateDaysOfWeek.includes(day.value) && styles.dayChipActive]}
                            onPress={() => setTemplateDaysOfWeek(prev => toggleWeekDay(prev, day.value))}
                          >
                            <Text style={[styles.dayChipText, templateDaysOfWeek.includes(day.value) && styles.dayChipTextActive]}>{day.label}</Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={styles.blockSectionTitle}>Bloques extra (opcional)</Text>
                      {templateExtraWeeklySlots.map((slot, slotIndex) => (
                        <View key={slot.id} style={styles.extraBlockCard}>
                          <View style={styles.extraBlockHeader}>
                            <Text style={styles.extraBlockTitle}>Bloque {slotIndex + 2}</Text>
                            <Pressable
                              style={styles.removeBlockButton}
                              onPress={() => setTemplateExtraWeeklySlots(prev => prev.filter(item => item.id !== slot.id))}
                            >
                              <Text style={styles.removeBlockButtonText}>Quitar</Text>
                            </Pressable>
                          </View>

                          <View style={styles.dayChipsRow}>
                            {WEEK_DAY_OPTIONS.map(day => (
                              <Pressable
                                key={`${slot.id}-${day.value}`}
                                style={[styles.dayChip, slot.daysOfWeek.includes(day.value) && styles.dayChipActive]}
                                onPress={() => setTemplateExtraWeeklySlots(prev => prev.map(item => item.id === slot.id ? { ...item, daysOfWeek: toggleWeekDay(item.daysOfWeek, day.value) } : item))}
                              >
                                <Text style={[styles.dayChipText, slot.daysOfWeek.includes(day.value) && styles.dayChipTextActive]}>{day.label}</Text>
                              </Pressable>
                            ))}
                          </View>

                          <TextInput
                            style={[styles.input, styles.scheduleInput]}
                            value={slot.timeDraft}
                            onChangeText={(value) => setTemplateExtraWeeklySlots(prev => prev.map(item => item.id === slot.id ? { ...item, timeDraft: normalizeTimeInput(value) } : item))}
                            placeholder="20:00"
                            placeholderTextColor={Colors.muted}
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      ))}

                      <Pressable style={styles.addBlockButton} onPress={() => setTemplateExtraWeeklySlots(prev => [...prev, createWeeklySlotDraft()])}>
                        <Text style={styles.addBlockButtonText}>Agregar bloque semanal AM/PM</Text>
                      </Pressable>
                    </>
                  )}

                  {templateFrequency === 'daily' && (
                    <>
                      <Text style={styles.blockSectionTitle}>Bloques extra diarios (opcional)</Text>
                      {templateExtraWeeklySlots.map((slot, slotIndex) => (
                        <View key={slot.id} style={styles.extraBlockCard}>
                          <View style={styles.extraBlockHeader}>
                            <Text style={styles.extraBlockTitle}>Bloque {slotIndex + 2}</Text>
                            <Pressable
                              style={styles.removeBlockButton}
                              onPress={() => setTemplateExtraWeeklySlots(prev => prev.filter(item => item.id !== slot.id))}
                            >
                              <Text style={styles.removeBlockButtonText}>Quitar</Text>
                            </Pressable>
                          </View>

                          <TextInput
                            style={[styles.input, styles.scheduleInput]}
                            value={slot.timeDraft}
                            onChangeText={(value) => setTemplateExtraWeeklySlots(prev => prev.map(item => item.id === slot.id ? { ...item, timeDraft: normalizeTimeInput(value) } : item))}
                            placeholder="20:00"
                            placeholderTextColor={Colors.muted}
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      ))}

                      <Pressable style={styles.addBlockButton} onPress={() => setTemplateExtraWeeklySlots(prev => [...prev, createWeeklySlotDraft()])}>
                        <Text style={styles.addBlockButtonText}>Agregar bloque diario AM/PM</Text>
                      </Pressable>
                    </>
                  )}

                  {templateFrequency === 'monthly' && (
                    <View style={styles.scheduleRow}>
                      <Text style={styles.infoLabel}>Día del mes (1-28)</Text>
                      <TextInput
                        style={[styles.input, styles.scheduleInput]}
                        value={String(templateDayOfMonth)}
                        onChangeText={(value) => setTemplateDayOfMonth(clampDayOfMonth(value))}
                        keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                      />
                    </View>
                  )}

                  <View style={styles.scheduleRow}>
                    <Text style={styles.infoLabel}>Horario (HH:MM)</Text>
                    <TextInput
                      style={[styles.input, styles.scheduleInput]}
                      value={templateTimeDraft}
                      onChangeText={(value) => setTemplateTimeDraft(normalizeTimeInput(value))}
                      placeholder="20:00"
                      placeholderTextColor={Colors.muted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>

                  <View style={styles.actionsRow}>
                    <Pressable style={styles.secondaryButton} onPress={() => setTemplateToActivate(null)}>
                      <Text style={styles.secondaryButtonText}>Cancelar</Text>
                    </Pressable>
                    <Pressable style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={handleActivateTemplate} disabled={saving}>
                      <Text style={styles.primaryButtonText}>{saving ? 'Guardando...' : 'Activar tarea'}</Text>
                    </Pressable>
                  </View>
                </View>
              </Reveal>
            )}

            {isProPlan ? (
              <Reveal delay={130}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Tarea personalizada</Text>
                  <TextInput
                    style={styles.input}
                    value={customTaskNameDraft}
                    onChangeText={setCustomTaskNameDraft}
                    placeholder="Ej: Limpiar terraza"
                    placeholderTextColor={Colors.muted}
                    autoCapitalize="sentences"
                    autoCorrect={false}
                  />

                  <View style={styles.frequencyRow}>
                    <Pressable style={[styles.frequencyChip, customTaskFrequency === 'daily' && styles.frequencyChipActive]} onPress={() => setCustomTaskFrequency('daily')}>
                      <Text style={[styles.frequencyChipText, customTaskFrequency === 'daily' && styles.frequencyChipTextActive]}>Diaria</Text>
                    </Pressable>
                    <Pressable style={[styles.frequencyChip, customTaskFrequency === 'weekly' && styles.frequencyChipActive]} onPress={() => setCustomTaskFrequency('weekly')}>
                      <Text style={[styles.frequencyChipText, customTaskFrequency === 'weekly' && styles.frequencyChipTextActive]}>Semanal</Text>
                    </Pressable>
                    <Pressable style={[styles.frequencyChip, customTaskFrequency === 'monthly' && styles.frequencyChipActive]} onPress={() => setCustomTaskFrequency('monthly')}>
                      <Text style={[styles.frequencyChipText, customTaskFrequency === 'monthly' && styles.frequencyChipTextActive]}>Mensual</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.infoLabel}>Audiencia</Text>
                  <View style={styles.frequencyRow}>
                    {TASK_AUDIENCE_OPTIONS.map(option => (
                      <Pressable
                        key={`custom-${option.value}`}
                        style={[styles.frequencyChip, customTaskAudience === option.value && styles.frequencyChipActive]}
                        onPress={() => setCustomTaskAudience(option.value)}
                        disabled={!isProPlan}
                      >
                        <Text style={[styles.frequencyChipText, customTaskAudience === option.value && styles.frequencyChipTextActive]}>{option.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {customTaskFrequency === 'weekly' && (
                    <>
                      <View style={styles.dayChipsRow}>
                        {WEEK_DAY_OPTIONS.map(day => (
                          <Pressable
                            key={day.value}
                            style={[styles.dayChip, customTaskDaysOfWeek.includes(day.value) && styles.dayChipActive]}
                            onPress={() => setCustomTaskDaysOfWeek(prev => toggleWeekDay(prev, day.value))}
                          >
                            <Text style={[styles.dayChipText, customTaskDaysOfWeek.includes(day.value) && styles.dayChipTextActive]}>{day.label}</Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={styles.blockSectionTitle}>Bloques extra (opcional)</Text>
                      {customExtraWeeklySlots.map((slot, slotIndex) => (
                        <View key={slot.id} style={styles.extraBlockCard}>
                          <View style={styles.extraBlockHeader}>
                            <Text style={styles.extraBlockTitle}>Bloque {slotIndex + 2}</Text>
                            <Pressable
                              style={styles.removeBlockButton}
                              onPress={() => setCustomExtraWeeklySlots(prev => prev.filter(item => item.id !== slot.id))}
                            >
                              <Text style={styles.removeBlockButtonText}>Quitar</Text>
                            </Pressable>
                          </View>

                          <View style={styles.dayChipsRow}>
                            {WEEK_DAY_OPTIONS.map(day => (
                              <Pressable
                                key={`${slot.id}-${day.value}`}
                                style={[styles.dayChip, slot.daysOfWeek.includes(day.value) && styles.dayChipActive]}
                                onPress={() => setCustomExtraWeeklySlots(prev => prev.map(item => item.id === slot.id ? { ...item, daysOfWeek: toggleWeekDay(item.daysOfWeek, day.value) } : item))}
                              >
                                <Text style={[styles.dayChipText, slot.daysOfWeek.includes(day.value) && styles.dayChipTextActive]}>{day.label}</Text>
                              </Pressable>
                            ))}
                          </View>

                          <TextInput
                            style={[styles.input, styles.scheduleInput]}
                            value={slot.timeDraft}
                            onChangeText={(value) => setCustomExtraWeeklySlots(prev => prev.map(item => item.id === slot.id ? { ...item, timeDraft: normalizeTimeInput(value) } : item))}
                            placeholder="20:00"
                            placeholderTextColor={Colors.muted}
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      ))}

                      <Pressable style={styles.addBlockButton} onPress={() => setCustomExtraWeeklySlots(prev => [...prev, createWeeklySlotDraft()])}>
                        <Text style={styles.addBlockButtonText}>Agregar bloque semanal AM/PM</Text>
                      </Pressable>
                    </>
                  )}

                  {customTaskFrequency === 'daily' && (
                    <>
                      <Text style={styles.blockSectionTitle}>Bloques extra diarios (opcional)</Text>
                      {customExtraWeeklySlots.map((slot, slotIndex) => (
                        <View key={slot.id} style={styles.extraBlockCard}>
                          <View style={styles.extraBlockHeader}>
                            <Text style={styles.extraBlockTitle}>Bloque {slotIndex + 2}</Text>
                            <Pressable
                              style={styles.removeBlockButton}
                              onPress={() => setCustomExtraWeeklySlots(prev => prev.filter(item => item.id !== slot.id))}
                            >
                              <Text style={styles.removeBlockButtonText}>Quitar</Text>
                            </Pressable>
                          </View>

                          <TextInput
                            style={[styles.input, styles.scheduleInput]}
                            value={slot.timeDraft}
                            onChangeText={(value) => setCustomExtraWeeklySlots(prev => prev.map(item => item.id === slot.id ? { ...item, timeDraft: normalizeTimeInput(value) } : item))}
                            placeholder="20:00"
                            placeholderTextColor={Colors.muted}
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                      ))}

                      <Pressable style={styles.addBlockButton} onPress={() => setCustomExtraWeeklySlots(prev => [...prev, createWeeklySlotDraft()])}>
                        <Text style={styles.addBlockButtonText}>Agregar bloque diario AM/PM</Text>
                      </Pressable>
                    </>
                  )}

                  {customTaskFrequency === 'monthly' && (
                    <View style={styles.scheduleRow}>
                      <Text style={styles.infoLabel}>Día del mes (1-28)</Text>
                      <TextInput
                        style={[styles.input, styles.scheduleInput]}
                        value={String(customTaskDayOfMonth)}
                        onChangeText={(value) => setCustomTaskDayOfMonth(clampDayOfMonth(value))}
                        keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                      />
                    </View>
                  )}

                  <View style={styles.scheduleRow}>
                    <Text style={styles.infoLabel}>Horario (HH:MM)</Text>
                    <TextInput
                      style={[styles.input, styles.scheduleInput]}
                      value={customTaskTimeDraft}
                      onChangeText={(value) => setCustomTaskTimeDraft(normalizeTimeInput(value))}
                      placeholder="20:00"
                      placeholderTextColor={Colors.muted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>

                  <Pressable style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={handleAddCustomTask} disabled={saving}>
                    <Text style={styles.primaryButtonText}>{saving ? 'Guardando...' : 'Agregar tarea personalizada'}</Text>
                  </Pressable>
                </View>
              </Reveal>
            ) : (
              <Pressable style={styles.planHintBox} onPress={() => goToPaywall('household-free-hint')}>
                <Text style={styles.planHintTitle}>Plan Free: solo tareas fijas</Text>
                <Text style={styles.planHintText}>Para crear tareas personalizadas, actualiza a plan Hogar o Familia.</Text>
              </Pressable>
            )}
          </>
        )}

        <Pressable style={styles.backButton} onPress={() => router.replace('/(app)/household')}>
          <Text style={styles.backButtonText}>Volver a Mi Hogar</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  headerCard: {
    backgroundColor: '#2E1A11',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#8F5B3E',
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...ShadowPresets.soft,
  },
  eyebrow: {
    color: '#F4DCC3',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  headerMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    color: '#FFF8F1',
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: '#E8D9C8',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...ShadowPresets.soft,
  },
  cardTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  templateCard: {
    width: '23%',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#EADFCC',
    backgroundColor: '#FFF8F1',
    padding: 6,
    gap: 4,
  },
  templateCardDisabled: {
    opacity: 0.85,
  },
  templateThumb: {
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E0D2BC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateThumbText: {
    color: '#2F241F',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  templateName: {
    color: Colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
    minHeight: 26,
  },
  templateMeta: {
    color: '#7A6758',
    fontSize: 10,
    fontWeight: '600',
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  frequencyChip: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#D8C9B4',
    backgroundColor: '#FFF6EC',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  frequencyChipActive: {
    borderColor: '#C96B2C',
    backgroundColor: '#FCE8D9',
  },
  frequencyChipText: {
    color: '#7A6758',
    fontSize: 12,
    fontWeight: '700',
  },
  frequencyChipTextActive: {
    color: '#8F3F0A',
  },
  dayChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: '#D8C9B4',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  dayChipActive: {
    borderColor: '#C96B2C',
    backgroundColor: '#FCE8D9',
  },
  dayChipText: {
    color: '#7A6758',
    fontSize: 12,
    fontWeight: '700',
  },
  dayChipTextActive: {
    color: '#8F3F0A',
  },
  blockSectionTitle: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  extraBlockCard: {
    borderWidth: 1,
    borderColor: '#F1D7B8',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF6EC',
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  extraBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  extraBlockTitle: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  removeBlockButton: {
    borderWidth: 1,
    borderColor: '#E5B9A9',
    borderRadius: BorderRadius.full,
    backgroundColor: '#FBEAE4',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  removeBlockButtonText: {
    color: '#A14A33',
    fontSize: 11,
    fontWeight: '700',
  },
  addBlockButton: {
    borderWidth: 1,
    borderColor: '#E6C6A1',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF1E4',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
  },
  addBlockButtonText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  infoLabel: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  scheduleRow: {
    gap: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text.primary,
    fontSize: 15,
    backgroundColor: Colors.background,
  },
  scheduleInput: {
    backgroundColor: '#FFFFFF',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D8C9B4',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#7A6758',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  planHintBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#F1D7B8',
    backgroundColor: '#FFF4E8',
    padding: Spacing.sm,
    gap: 4,
  },
  planHintTitle: {
    color: '#8F5B3E',
    fontSize: 13,
    fontWeight: '700',
  },
  planHintText: {
    color: '#7A6758',
    fontSize: 12,
    lineHeight: 16,
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#E6C6A1',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF1E4',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    color: '#B45309',
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  feedbackSuccess: {
    backgroundColor: '#EEF6F0',
    borderColor: '#CFE2D3',
  },
  feedbackError: {
    backgroundColor: '#FBEAE4',
    borderColor: '#E5B9A9',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  feedbackTextSuccess: {
    color: '#3F7D58',
  },
  feedbackTextError: {
    color: '#A14A33',
  },
  activeTaskList: {
    gap: Spacing.xs,
  },
  activeTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE2D0',
  },
  activeTaskInfo: {
    flex: 1,
    gap: 2,
  },
  activeTaskName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  activeTaskMeta: {
    color: Colors.text.secondary,
    fontSize: 11,
  },
  deactivateButton: {
    borderWidth: 1,
    borderColor: '#E5B9A9',
    borderRadius: BorderRadius.full,
    backgroundColor: '#FBEAE4',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    marginLeft: Spacing.sm,
  },
  deactivateButtonText: {
    color: '#A14A33',
    fontSize: 11,
    fontWeight: '700',
  },
})
