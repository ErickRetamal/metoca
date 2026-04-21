import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { BorderRadius, Colors, Spacing, ShadowPresets } from '../../../constants/theme'
import { CollapsibleCard } from '../../../components/ui/collapsible-card'
import { Reveal } from '../../../components/ui/reveal'
import { Skeleton } from '../../../components/ui/skeleton'
import { HamburgerButton } from '../../../components/dashboard/side-menu'
import { useMenuContext } from '../../../lib/menu-context'
import { supabase } from '../../../lib/supabase'
import { getCurrentPlanAsync, invalidateDashboardContextCache } from '../../../lib/dashboard'
import { goToPaywall } from '../../../lib/navigation'
import { firstNameOnly, nameFromEmail } from '../../../lib/user-name'

interface TaskTemplate {
  key: string
  name: string
  code: string
  color: string
  frequency: 'daily' | 'weekly' | 'monthly'
  notificationTime: string
  dayOfWeek?: number
  dayOfMonth?: number
}

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

type MemberProfile = 'adulto' | 'joven'

interface HouseholdData {
  id: string
  name: string
  adminUserId: string
  inviteCode: string
  adminName: string
  members: { id: string; name: string; profile: MemberProfile }[]
}

type AppPlan = 'free' | 'hogar' | 'familia'

interface PlanGuardNotice {
  overCapacity: boolean
  effectivePlan: AppPlan
  maxMembers: number
  activeMembers: number
  membersToRemove: number
  graceEndsAt: string | null
  membersPreview: Array<{ user_id: string; name: string }>
}

function getCustomTaskLimit(plan: AppPlan): number {
  if (plan === 'hogar') return 5
  if (plan === 'familia') return 30
  return 0
}

function getPlanLabel(plan: AppPlan): string {
  if (plan === 'hogar') return 'Hogar'
  if (plan === 'familia') return 'Familia'
  return 'Gratis'
}

function getTaskCode(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TT'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function getTaskThumbColor(name: string): string {
  const palette = ['#FCE8D9', '#EAF3E8', '#FBE7DE', '#F9EED0', '#F7E4DB', '#EEE5D9', '#EFE8E1', '#F6DFD7']
  const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

export default function HouseholdScreen() {
  const { onMenuPress } = useMenuContext()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transferringAdminId, setTransferringAdminId] = useState<string | null>(null)
  const [household, setHousehold] = useState<HouseholdData | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedTaskNames, setSelectedTaskNames] = useState<string[]>([])
  const [customTasks, setCustomTasks] = useState<Array<{ id: string; name: string; frequency: 'daily' | 'weekly' | 'monthly' }>>([])
  const [plan, setPlan] = useState<AppPlan>('free')
  const [planGuardNotice, setPlanGuardNotice] = useState<PlanGuardNotice | null>(null)
  const [customTaskNameDraft, setCustomTaskNameDraft] = useState('')
  const [customTaskFrequency, setCustomTaskFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly')

  // Create flow
  const [householdNameDraft, setHouseholdNameDraft] = useState('')

  // Join flow
  const [inviteCodeDraft, setInviteCodeDraft] = useState('')

  // Edit flow
  const [isEditing, setIsEditing] = useState(false)
  const [editNameDraft, setEditNameDraft] = useState('')

  useEffect(() => {
    loadHousehold()
  }, [])

  async function loadHousehold() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      const nextPlan = await getCurrentPlanAsync()
      setPlan(nextPlan)

      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (!membership?.household_id) {
        setHousehold(null)
        setPlanGuardNotice(null)
        setSelectedTaskNames([])
        setCustomTasks([])
        return
      }

      const [{ data: hh }, { data: memberRows }] = await Promise.all([
        supabase
          .from('households')
          .select('id, name, admin_user_id, invite_code')
          .eq('id', membership.household_id)
          .maybeSingle(),
        supabase
          .from('household_members')
          .select('user_id, profile, users(name, email)')
          .eq('household_id', membership.household_id)
          .eq('status', 'active'),
      ])

      if (!hh) {
        setHousehold(null)
        setPlanGuardNotice(null)
        return
      }

      const members: { id: string; name: string; profile: MemberProfile }[] =
        (memberRows ?? []).map((row: any) => ({
          id: row.user_id,
          name: firstNameOnly(row.users?.name ?? nameFromEmail(row.users?.email), 'Miembro'),
          profile: (row.profile ?? 'adulto') as MemberProfile,
        }))

      const adminMember = members.find(m => m.id === hh.admin_user_id)
      const adminName = adminMember?.name ?? (hh.admin_user_id === user.id ? 'Tú' : 'Desconocido')

      setHousehold({
        id: hh.id,
        name: hh.name,
        adminUserId: hh.admin_user_id,
        inviteCode: hh.invite_code,
        adminName,
        members,
      })

      const { data: guardData } = await supabase.rpc('get_household_plan_guard_status', {
        p_household_id: hh.id,
      })

      if (guardData && (guardData as any).over_capacity === true) {
        const rawMembers = Array.isArray((guardData as any).members_preview) ? (guardData as any).members_preview : []
        setPlanGuardNotice({
          overCapacity: true,
          effectivePlan: ((guardData as any).effective_plan ?? 'free') as AppPlan,
          maxMembers: Number((guardData as any).max_members ?? 2),
          activeMembers: Number((guardData as any).active_members ?? members.length),
          membersToRemove: Number((guardData as any).members_to_remove ?? 0),
          graceEndsAt: typeof (guardData as any).grace_ends_at === 'string' ? (guardData as any).grace_ends_at : null,
          membersPreview: rawMembers
            .map((row: any) => ({
              user_id: String(row.user_id ?? ''),
              name: firstNameOnly(String(row.name ?? ''), 'Miembro'),
            }))
            .filter((row: any) => row.user_id),
        })
      } else {
        setPlanGuardNotice(null)
      }

      await loadHouseholdTasks(hh.id)
    } finally {
      setLoading(false)
    }
  }

  async function loadHouseholdTasks(householdId: string) {
    const { data: rows } = await supabase
      .from('tasks')
      .select('id, name, frequency')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .is('deleted_at', null)

    const names = (rows ?? []).map((row: any) => row.name)
    const templateNameSet = new Set(TASK_TEMPLATES.map(template => template.name))
    const loadedCustomTasks = (rows ?? [])
      .filter((row: any) => !templateNameSet.has(row.name))
      .map((row: any) => ({
        id: row.id,
        name: row.name,
        frequency: row.frequency as 'daily' | 'weekly' | 'monthly',
      }))

    setSelectedTaskNames(names)
    setCustomTasks(loadedCustomTasks)
  }

  async function handleCreate() {
    const name = householdNameDraft.trim()
    if (!name) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para tu hogar.')
      return
    }
    if (!currentUserId) return
    setSaving(true)
    try {
      const { data: newHH, error: createError } = await supabase
        .from('households')
        .insert({ name, admin_user_id: currentUserId })
        .select('id')
        .single()

      if (createError || !newHH) {
        Alert.alert('Error', createError?.message ?? 'No se pudo crear el hogar.')
        return
      }

      const { error: joinError } = await supabase
        .from('household_members')
        .insert({ household_id: newHH.id, user_id: currentUserId, status: 'active', joined_at: new Date().toISOString() })

      if (joinError) {
        Alert.alert('Error', joinError.message)
        return
      }

      setHouseholdNameDraft('')
      invalidateDashboardContextCache()
      await loadHousehold()
    } finally {
      setSaving(false)
    }
  }

  async function handleJoin() {
    const code = inviteCodeDraft.trim().toUpperCase()
    if (!code) {
      const message = 'Escribe el codigo de invitacion.'
      if (Platform.OS === 'web') {
        ;(globalThis as any).alert?.(message)
      } else {
        Alert.alert('Codigo requerido', message)
      }
      return
    }
    if (!currentUserId) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('join_household_by_invite_code', {
        p_invite_code: code,
      })

      if (error) {
        const msg = (error.message ?? '').toLowerCase()
        const invalidCode = msg.includes('invalid_invite_code')
        const missingRpc = msg.includes('join_household_by_invite_code') && msg.includes('does not exist')
        const text = invalidCode
          ? 'No encontramos un hogar con ese codigo.'
          : missingRpc
            ? 'Falta aplicar migraciones en la base de datos. Ejecuta las migraciones de Supabase y vuelve a intentar.'
          : error.message

        if (Platform.OS === 'web') {
          ;(globalThis as any).alert?.(text)
        } else {
          Alert.alert(invalidCode ? 'Codigo invalido' : missingRpc ? 'Migraciones pendientes' : 'Error', text)
        }
        return
      }

      setInviteCodeDraft('')
      invalidateDashboardContextCache()
      await loadHousehold()
    } finally {
      setSaving(false)
    }
  }

  async function handleLeave() {
    if (!household || !currentUserId) return

    const isAdminMember = household.adminUserId === currentUserId
    const isOnlyMember = isAdminMember && household.members.length === 1

    const executeLeaveRpc = async () => {
      setSaving(true)
      try {
        const { data, error } = await supabase.rpc('leave_or_delete_household', {
          p_household_id: household.id,
        })

        if (error) {
          const msg = (error.message ?? '').toLowerCase()
          if (msg.includes('transfer_required')) {
            const transferMessage = 'Primero debes transferir la jefatura para poder salir del hogar.'
            if (Platform.OS === 'web') {
              ;(globalThis as any).alert?.(transferMessage)
            } else {
              Alert.alert('Transferencia requerida', transferMessage)
            }
            return
          }

          if (Platform.OS === 'web') {
            ;(globalThis as any).alert?.(error.message)
          } else {
            Alert.alert('Error', error.message)
          }
          return
        }

        setHousehold(null)
        invalidateDashboardContextCache()

        const mode = (data as any)?.mode
        if (mode === 'deleted_and_left') {
          const successMessage = 'Abandonaste y eliminaste el hogar correctamente.'
          if (Platform.OS === 'web') {
            ;(globalThis as any).alert?.(successMessage)
          } else {
            Alert.alert('Listo', successMessage)
          }
        }
      } finally {
        setSaving(false)
      }
    }

    if (isAdminMember && !isOnlyMember) {
      const message = 'No puedes salirte siendo jefe. Transfiere el rol o elimina el hogar.'
      if (Platform.OS === 'web') {
        ;(globalThis as any).alert?.(message)
      } else {
        Alert.alert('Eres el administrador', message)
      }
      return
    }

    if (Platform.OS === 'web') {
      const question = isOnlyMember
        ? `Eres el único miembro. ¿Abandonar y eliminar "${household.name}"?`
        : `¿Salir de "${household.name}"?`
      const confirmed = (globalThis as any).confirm?.(question) ?? false
      if (!confirmed) return
      await executeLeaveRpc()
      return
    }

    Alert.alert(
      isOnlyMember ? 'Abandonar y eliminar hogar' : 'Salir del hogar',
      isOnlyMember
        ? `Eres el único miembro. Esta acción eliminará "${household.name}".`
        : `¿Salir de "${household.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isOnlyMember ? 'Abandonar y eliminar' : 'Salir',
          style: 'destructive',
          onPress: () => { void executeLeaveRpc() },
        },
      ]
    )
  }

  async function handleTransferAdmin(nextAdminId: string, nextAdminName: string) {
    if (!household || !currentUserId) return
    if (household.adminUserId !== currentUserId) return
    if (nextAdminId === currentUserId) return

    const executeTransfer = async () => {
      setTransferringAdminId(nextAdminId)
      try {
        const { error } = await supabase
          .from('households')
          .update({ admin_user_id: nextAdminId })
          .eq('id', household.id)

        if (error) {
          if (Platform.OS === 'web') {
            ;(globalThis as any).alert?.(error.message)
          } else {
            Alert.alert('Error', error.message)
          }
          return
        }

        setHousehold(prev => prev ? {
          ...prev,
          adminUserId: nextAdminId,
          adminName: nextAdminName,
        } : prev)

        invalidateDashboardContextCache()

        const successMessage = `Ahora ${nextAdminName} es el jefe de hogar.`
        if (Platform.OS === 'web') {
          ;(globalThis as any).alert?.(successMessage)
        } else {
          Alert.alert('Listo', successMessage)
        }
      } finally {
        setTransferringAdminId(null)
      }
    }

    if (Platform.OS === 'web') {
      const confirmed = (globalThis as any).confirm?.(`¿Quieres transferir el hogar a ${nextAdminName}?`) ?? false
      if (!confirmed) return
      await executeTransfer()
      return
    }

    Alert.alert(
      'Transferir jefatura',
      `¿Quieres transferir el hogar a ${nextAdminName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Transferir',
          onPress: () => { void executeTransfer() },
        },
      ]
    )
  }

  async function handleUpdateMemberProfile(memberId: string, profile: MemberProfile) {
    if (!household || !currentUserId) return
    if (household.adminUserId !== currentUserId) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('household_members')
        .update({ profile })
        .eq('household_id', household.id)
        .eq('user_id', memberId)
        .eq('status', 'active')

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      setHousehold(prev => {
        if (!prev) return prev
        return {
          ...prev,
          members: prev.members.map(member =>
            member.id === memberId ? { ...member, profile } : member
          ),
        }
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    const name = editNameDraft.trim()
    if (!name) {
      Alert.alert('Nombre requerido', 'El nombre del hogar no puede estar vacío.')
      return
    }
    if (!household) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('households')
        .update({ name })
        .eq('id', household.id)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      setHousehold(prev => prev ? { ...prev, name } : prev)
      setIsEditing(false)
      invalidateDashboardContextCache()
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyInviteCode(code: string) {
    await Clipboard.setStringAsync(code)
    Alert.alert('Código copiado', 'El código de invitación se copió al portapapeles.')
  }

  async function toggleTemplate(template: TaskTemplate) {
    if (!household || !currentUserId) return

    if (household.adminUserId !== currentUserId) {
      Alert.alert('Solo el jefe puede editar', 'Pide al jefe de hogar que seleccione las tareas del hogar.')
      return
    }

    const isSelected = selectedTaskNames.includes(template.name)
    setSaving(true)
    try {
      if (isSelected) {
        const { error } = await supabase
          .from('tasks')
          .update({ is_active: false, deleted_at: new Date().toISOString() })
          .eq('household_id', household.id)
          .eq('name', template.name)

        if (error) {
          Alert.alert('Error', error.message)
          return
        }

        const { data: deactivatedTasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('household_id', household.id)
          .eq('name', template.name)

        const todayKey = new Date().toISOString().slice(0, 10)
        const deactivatedIds = (deactivatedTasks ?? []).map((row: any) => row.id)
        if (deactivatedIds.length > 0) {
          await supabase
            .from('task_executions')
            .update({ status: 'missed' })
            .in('task_id', deactivatedIds)
            .eq('status', 'pending')
            .gte('scheduled_date', todayKey)
        }

        setSelectedTaskNames(prev => prev.filter(name => name !== template.name))
        return
      }

      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('household_id', household.id)
        .eq('name', template.name)
        .limit(1)

      if (existing && existing.length > 0) {
        const { error: reactivateError } = await supabase
          .from('tasks')
          .update({
            is_active: true,
            deleted_at: null,
            frequency: template.frequency,
            notification_time: template.notificationTime,
            day_of_week: template.dayOfWeek ?? null,
            day_of_month: template.dayOfMonth ?? null,
          })
          .eq('id', existing[0].id)

        if (reactivateError) {
          Alert.alert('Error', reactivateError.message)
          return
        }
      } else {
        const { error: insertError } = await supabase
          .from('tasks')
          .insert({
            household_id: household.id,
            name: template.name,
            frequency: template.frequency,
            notification_time: template.notificationTime,
            day_of_week: template.dayOfWeek ?? null,
            day_of_month: template.dayOfMonth ?? null,
            created_by: currentUserId,
            is_active: true,
          })

        if (insertError) {
          Alert.alert('Error', insertError.message)
          return
        }
      }

      setSelectedTaskNames(prev => [...prev, template.name])
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCustomTask() {
    if (!household || !currentUserId) return

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

    if (household.adminUserId !== currentUserId) {
      Alert.alert('Solo el jefe puede editar', 'Pide al jefe de hogar que agregue tareas personalizadas.')
      return
    }

    const taskName = customTaskNameDraft.trim()
    if (!taskName) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para la tarea personalizada.')
      return
    }

    const lowerName = taskName.toLowerCase()
    const alreadyExists = selectedTaskNames.some(name => name.toLowerCase() === lowerName)
    if (alreadyExists) {
      Alert.alert('Ya existe', 'Esa tarea ya esta activa en el hogar.')
      return
    }

    const maxCustomTasks = getCustomTaskLimit(plan)
    if (customTasks.length >= maxCustomTasks) {
      Alert.alert(
        'Limite alcanzado',
        `Tu plan actual permite hasta ${maxCustomTasks} tareas personalizadas activas.`
      )
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          household_id: household.id,
          name: taskName,
          frequency: customTaskFrequency,
          notification_time: '20:00:00',
          day_of_week: customTaskFrequency === 'weekly' ? 1 : null,
          day_of_month: customTaskFrequency === 'monthly' ? 1 : null,
          created_by: currentUserId,
          is_active: true,
        })

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      setCustomTaskNameDraft('')
      setCustomTaskFrequency('weekly')
      await loadHouseholdTasks(household.id)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveCustomTask(taskId: string) {
    if (!household || !currentUserId) return

    if (household.adminUserId !== currentUserId) {
      Alert.alert('Solo el jefe puede editar', 'Pide al jefe de hogar que gestione las tareas personalizadas.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('household_id', household.id)

      if (error) {
        Alert.alert('Error', error.message)
        return
      }

      const todayKey = new Date().toISOString().slice(0, 10)
      await supabase
        .from('task_executions')
        .update({ status: 'missed' })
        .eq('task_id', taskId)
        .eq('status', 'pending')
        .gte('scheduled_date', todayKey)

      await loadHouseholdTasks(household.id)
    } finally {
      setSaving(false)
    }
  }

  const isAdmin = household?.adminUserId === currentUserId
  const isProPlan = plan !== 'free'
  const transferCandidates = household?.members.filter(member => member.id !== currentUserId) ?? []
  const isOnlyMember = Boolean(isAdmin && household && household.members.length === 1)
  const graceDaysLeft = planGuardNotice?.graceEndsAt
    ? Math.max(0, Math.ceil((new Date(planGuardNotice.graceEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null
  const graceEndsFormatted = planGuardNotice?.graceEndsAt
    ? new Date(planGuardNotice.graceEndsAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.bgShapeTop} />
        <View style={styles.bgShapeBottom} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.headerCard}>
            <Skeleton width={120} height={14} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width={180} height={34} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="78%" height={16} />
          </View>

          <View style={styles.card}>
            <Skeleton width="55%" height={22} style={{ marginBottom: Spacing.md }} />
            <Skeleton width="100%" height={16} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="90%" height={16} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="65%" height={42} />
          </View>

          <View style={styles.card}>
            <Skeleton width="48%" height={22} style={{ marginBottom: Spacing.md }} />
            <Skeleton width="100%" height={60} style={{ marginBottom: Spacing.sm }} />
            <Skeleton width="100%" height={60} />
          </View>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgShapeTop} />
      <View style={styles.bgShapeBottom} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Reveal delay={0}>
          <View style={styles.headerCard}>
            <View style={styles.headerMenuRow}>
              <HamburgerButton onPress={onMenuPress} />
              <Text style={styles.eyebrow}>Gestión</Text>
            </View>
            <Text style={styles.title}>Mi Hogar</Text>
            <Text style={styles.subtitle}>
              {household ? 'Organiza tu hogar y sus miembros.' : 'Crea un hogar o únete con un código.'}
            </Text>
            {household ? (
              <View style={styles.headerPlanPill}>
                <Text style={styles.headerPlanPillLabel}>Plan del hogar</Text>
                <Text style={styles.headerPlanPillValue}>{getPlanLabel(plan)}</Text>
              </View>
            ) : null}
          </View>
        </Reveal>

        {household && planGuardNotice?.overCapacity && (
          <View style={styles.guardWarningBox}>
            <Text style={styles.guardWarningTitle}>Cambio de plan detectado</Text>
            <Text style={styles.guardWarningText}>
              Tu hogar tiene {planGuardNotice.activeMembers} miembros, pero el plan {planGuardNotice.effectivePlan} permite {planGuardNotice.maxMembers}.
            </Text>
            <Text style={styles.guardWarningText}>
              Si no actualizan el plan en {graceDaysLeft ?? 0} días{graceEndsFormatted ? ` (antes del ${graceEndsFormatted})` : ''}, se removerán {planGuardNotice.membersToRemove} miembro(s) por menor antigüedad.
            </Text>
            {planGuardNotice.membersPreview.length > 0 && (
              <Text style={styles.guardWarningMembers}>
                Posibles removidos: {planGuardNotice.membersPreview.map(member => member.name).join(', ')}
              </Text>
            )}
            <Pressable style={styles.guardWarningButton} onPress={() => goToPaywall('household-over-capacity-warning')}>
              <Text style={styles.guardWarningButtonText}>Actualizar plan</Text>
            </Pressable>
          </View>
        )}

        {household ? (
          <>
            {/* Household info */}
            <Reveal delay={90}>
              <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>
                  {isEditing ? 'Editar nombre' : household.name}
                </Text>
                {isAdmin && !isEditing && (
                  <Pressable onPress={() => { setEditNameDraft(household.name); setIsEditing(true) }}>
                    <Text style={styles.linkText}>Editar</Text>
                  </Pressable>
                )}
                {isEditing && (
                  <Pressable onPress={() => setIsEditing(false)}>
                    <Text style={styles.linkTextMuted}>Cancelar</Text>
                  </Pressable>
                )}
              </View>

              {isEditing ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={editNameDraft}
                    onChangeText={setEditNameDraft}
                    placeholder="Nombre del hogar"
                    placeholderTextColor={Colors.muted}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  <Pressable
                    style={[styles.primaryButton, saving && styles.buttonDisabled]}
                    onPress={handleSaveEdit}
                    disabled={saving}
                  >
                    <Text style={styles.primaryButtonText}>{saving ? 'Guardando...' : 'Guardar nombre'}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Jefe de hogar</Text>
                    <Text style={styles.infoValue}>
                      {isAdmin ? 'Tú' : household.adminName}
                    </Text>
                  </View>

                  {isAdmin && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Código de invitación</Text>
                      <Pressable onPress={() => handleCopyInviteCode(household.inviteCode)}>
                        <Text style={styles.inviteCode}>{household.inviteCode}</Text>
                        <Text style={styles.inviteCodeHint}>Tocar para copiar</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>
            </Reveal>

            {/* Members */}
            <Reveal delay={100}>
              <View style={styles.card}>
              <CollapsibleCard
                title={`Miembros (${household.members.length})`}
                subtitle="Revisa perfiles y roles del hogar."
              >
              {household.members.map(m => (
                <View key={m.id} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, m.id === household.adminUserId && styles.memberAvatarAdmin]}>
                    <Text style={styles.memberAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.id === currentUserId ? `${m.name} (tú)` : m.name}</Text>
                    <View style={styles.memberMetaRow}>
                      {m.id === household.adminUserId && (
                        <Text style={styles.memberRole}>Jefe de hogar</Text>
                      )}
                      <Text style={styles.memberProfileLabel}>{m.profile === 'adulto' ? 'Adulto' : 'Joven'}</Text>
                    </View>

                    {isAdmin && (
                      <View style={styles.memberProfileChips}>
                        <Pressable
                          style={[styles.memberProfileChip, m.profile === 'adulto' && styles.memberProfileChipActive]}
                          onPress={() => handleUpdateMemberProfile(m.id, 'adulto')}
                          disabled={saving}
                        >
                          <Text style={[styles.memberProfileChipText, m.profile === 'adulto' && styles.memberProfileChipTextActive]}>Adulto</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.memberProfileChip, m.profile === 'joven' && styles.memberProfileChipActive]}
                          onPress={() => handleUpdateMemberProfile(m.id, 'joven')}
                          disabled={saving}
                        >
                          <Text style={[styles.memberProfileChipText, m.profile === 'joven' && styles.memberProfileChipTextActive]}>Joven</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              </CollapsibleCard>
            </View>
            </Reveal>

            <Reveal delay={110}>
              <View style={styles.card}>
              <CollapsibleCard
                title="Tareas del hogar"
                subtitle={isAdmin ? 'Resumen y accesos de administración.' : 'Acceso rápido a las tareas del hogar de hoy.'}
              >
              <Text style={styles.cardSubtitle}>
                {isAdmin
                  ? 'Administra y asigna tareas desde la pantalla de configuración.'
                  : 'Revisa las tareas del hogar desde la vista diaria del hogar.'}
              </Text>

              <Pressable
                style={isAdmin ? styles.secondaryButton : styles.primaryButton}
                onPress={() => router.push({ pathname: '/(app)/(tabs)/today', params: { mode: 'household' } })}
              >
                <Text style={isAdmin ? styles.secondaryButtonText : styles.primaryButtonText}>Ver tareas de hoy</Text>
              </Pressable>

              {isAdmin && (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push('/(app)/household/configure-tasks')}
                >
                  <Text style={styles.primaryButtonText}>Abrir configuración de tareas</Text>
                </Pressable>
              )}
              </CollapsibleCard>
            </View>
            </Reveal>

            {/* Leave */}
            <Reveal delay={130}>
            {isAdmin && !isOnlyMember && (
              <View style={styles.card}>
                <CollapsibleCard
                  title="Transferir jefatura"
                  subtitle="Cambia el jefe de hogar antes de salir."
                >
                {transferCandidates.length === 0 ? (
                  <Text style={styles.cardSubtitle}>Necesitas al menos otro miembro activo para transferir el hogar.</Text>
                ) : (
                  <View style={styles.transferList}>
                    {transferCandidates.map(member => (
                      <Pressable
                        key={member.id}
                        style={[
                          styles.transferButton,
                          (saving || transferringAdminId === member.id) && styles.buttonDisabled,
                        ]}
                        onPress={() => handleTransferAdmin(member.id, member.name)}
                        disabled={saving || transferringAdminId !== null}
                      >
                        <Text style={styles.transferButtonText}>
                          {transferringAdminId === member.id ? 'Transfiriendo...' : `Transferir a ${member.name}`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                </CollapsibleCard>
              </View>
            )}

            <Pressable
              style={[styles.dangerButton, saving && styles.buttonDisabled]}
              onPress={handleLeave}
              disabled={saving}
            >
              <Text style={styles.dangerButtonText}>{isOnlyMember ? 'Abandonar y eliminar hogar' : 'Salir del hogar'}</Text>
            </Pressable>
            {isAdmin && !isOnlyMember && (
              <Text style={styles.leaveHintText}>Primero transfiere la jefatura para poder salir del hogar.</Text>
            )}
            </Reveal>
          </>
        ) : (
          <>
            {/* Create */}
            <Reveal delay={90}>
              <View style={styles.card}>
              <CollapsibleCard
                title="Crear hogar"
                subtitle="Elige un nombre y comparte el código con tu familia."
                defaultExpanded={true}
              >
              <TextInput
                style={styles.input}
                value={householdNameDraft}
                onChangeText={setHouseholdNameDraft}
                placeholder="Nombre del hogar"
                placeholderTextColor={Colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Creando...' : 'Crear hogar'}</Text>
              </Pressable>
              </CollapsibleCard>
            </View>
            </Reveal>

            {/* Join */}
            <Reveal delay={100}>
              <View style={styles.card}>
              <CollapsibleCard
                title="Unirme con código"
                subtitle="Pídele a tu jefe de hogar el código de 8 caracteres."
              >
              <TextInput
                style={[styles.input, styles.inputCode]}
                value={inviteCodeDraft}
                onChangeText={setInviteCodeDraft}
                placeholder="XXXXXXXX"
                placeholderTextColor={Colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
              />
              <Pressable
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={handleJoin}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Uniéndome...' : 'Unirme'}</Text>
              </Pressable>
              </CollapsibleCard>
            </View>
            </Reveal>
          </>
        )}
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  bgShapeTop: {
    position: 'absolute',
    top: -70,
    right: -85,
    width: 230,
    height: 230,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F8CFA9',
    opacity: 0.1,
  },
  bgShapeBottom: {
    position: 'absolute',
    bottom: 85,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F5DECA',
    opacity: 0.08,
  },
  headerCard: {
    backgroundColor: '#4A2F1E',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#8A5A3B',
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...ShadowPresets.soft,
  },
  headerMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eyebrow: {
    color: '#F5D4B3',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    color: '#FFF7EF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#F1D7BF',
    fontSize: 14,
    lineHeight: 20,
  },
  headerPlanPill: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(244, 220, 195, 0.34)',
    backgroundColor: 'rgba(244, 220, 195, 0.14)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPlanPillLabel: {
    color: '#F4DCC3',
    fontSize: 13,
    fontWeight: '600',
  },
  headerPlanPillValue: {
    color: '#FFF8F1',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    color: Colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  inviteCode: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  inviteCodeHint: {
    color: Colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 2,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: '#E5C8A7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarAdmin: {
    backgroundColor: '#8F5B3E',
  },
  memberAvatarText: {
    color: Colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  memberRole: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  memberProfileLabel: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  memberProfileChips: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  memberProfileChip: {
    borderWidth: 1,
    borderColor: '#D8C9B4',
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFF6EC',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  memberProfileChipActive: {
    borderColor: '#C57B2A',
    backgroundColor: '#FCEEDA',
  },
  memberProfileChipText: {
    color: '#57534E',
    fontSize: 11,
    fontWeight: '700',
  },
  memberProfileChipTextActive: {
    color: '#8A4C1B',
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
  templateCardSelected: {
    borderColor: '#C57B2A',
    backgroundColor: '#FCEEDA',
  },
  templateCardDisabled: {
    opacity: 0.85,
  },
  templateThumb: {
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#D8C9B4',
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
  planHintBox: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#F1D7B8',
    backgroundColor: '#FFF4E8',
    padding: Spacing.sm,
    gap: 4,
  },
  planHintTitle: {
    color: '#8A4C1B',
    fontSize: 13,
    fontWeight: '700',
  },
  planHintText: {
    color: '#7A6758',
    fontSize: 12,
    lineHeight: 16,
  },
  guardWarningBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E6C6A1',
    backgroundColor: '#FFF3E6',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  guardWarningTitle: {
    color: '#8A4C1B',
    fontSize: 14,
    fontWeight: '800',
  },
  guardWarningText: {
    color: '#7A6758',
    fontSize: 12,
    lineHeight: 17,
  },
  guardWarningMembers: {
    color: '#A8612A',
    fontSize: 12,
    fontWeight: '700',
  },
  guardWarningButton: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#C57B2A',
    backgroundColor: '#FCEEDA',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  guardWarningButtonText: {
    color: '#8A4C1B',
    fontSize: 13,
    fontWeight: '800',
  },
  customTaskEditor: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  customTaskTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
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
    borderColor: '#C57B2A',
    backgroundColor: '#FCEEDA',
  },
  frequencyChipText: {
    color: '#7A6758',
    fontSize: 12,
    fontWeight: '700',
  },
  frequencyChipTextActive: {
    color: '#8A4C1B',
  },
  customTaskList: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  customTaskListTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  customTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#EADFCC',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF8F1',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  customTaskThumb: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#D8C9B4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customTaskThumbText: {
    color: '#2F241F',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  customTaskInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  customTaskName: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  customTaskFrequency: {
    color: Colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  removeTaskButton: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  removeTaskButtonText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '700',
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
  inputCode: {
    fontFamily: 'monospace',
    letterSpacing: 3,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  primaryButton: {
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#E6C6A1',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF1E4',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  secondaryButtonText: {
    color: '#8A4C1B',
    fontSize: 15,
    fontWeight: '700',
  },
  dangerButton: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  dangerButtonText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  leaveHintText: {
    color: Colors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  transferList: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  transferButton: {
    borderWidth: 1,
    borderColor: '#E6C6A1',
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFF1E4',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  transferButtonText: {
    color: '#8A4C1B',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  linkTextMuted: {
    color: Colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
})
