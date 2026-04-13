import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native'
import { BorderRadius, Colors, Spacing, ShadowPresets } from '../../../constants/theme'
import { Reveal } from '../../../components/ui/reveal'
import { HamburgerButton } from '../../../components/dashboard/side-menu'
import { useMenuContext } from '../../../lib/menu-context'
import { supabase } from '../../../lib/supabase'
import { getCurrentPlanAsync, invalidateDashboardContextCache } from '../../../lib/dashboard'

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
  { key: 'dishes', name: 'Lavar platos', code: 'LP', color: '#DBEAFE', frequency: 'daily', notificationTime: '20:00:00' },
  { key: 'trash', name: 'Sacar basura', code: 'SB', color: '#E0E7FF', frequency: 'daily', notificationTime: '21:00:00' },
  { key: 'sweep', name: 'Barrer piso', code: 'BP', color: '#FCE7F3', frequency: 'daily', notificationTime: '19:00:00' },
  { key: 'bathroom', name: 'Limpiar bano', code: 'LB', color: '#ECFEFF', frequency: 'weekly', notificationTime: '10:00:00', dayOfWeek: 6 },
  { key: 'laundry', name: 'Lavar ropa', code: 'LR', color: '#F0FDF4', frequency: 'weekly', notificationTime: '11:00:00', dayOfWeek: 3 },
  { key: 'kitchen', name: 'Orden cocina', code: 'OC', color: '#FFF7ED', frequency: 'daily', notificationTime: '18:30:00' },
  { key: 'beds', name: 'Hacer camas', code: 'HC', color: '#FEF3C7', frequency: 'daily', notificationTime: '08:00:00' },
  { key: 'plants', name: 'Regar plantas', code: 'RP', color: '#DCFCE7', frequency: 'weekly', notificationTime: '09:00:00', dayOfWeek: 2 },
  { key: 'fridge', name: 'Revisar refri', code: 'RR', color: '#FAE8FF', frequency: 'weekly', notificationTime: '20:30:00', dayOfWeek: 0 },
  { key: 'dust', name: 'Quitar polvo', code: 'QP', color: '#EEF2FF', frequency: 'weekly', notificationTime: '12:00:00', dayOfWeek: 5 },
  { key: 'windows', name: 'Limpiar vidrios', code: 'LV', color: '#E0F2FE', frequency: 'monthly', notificationTime: '10:30:00', dayOfMonth: 10 },
  { key: 'pantry', name: 'Orden despensa', code: 'OD', color: '#FEF9C3', frequency: 'monthly', notificationTime: '17:00:00', dayOfMonth: 12 },
  { key: 'garage', name: 'Orden garage', code: 'OG', color: '#FFE4E6', frequency: 'monthly', notificationTime: '16:00:00', dayOfMonth: 15 },
  { key: 'shopping', name: 'Lista compras', code: 'LC', color: '#F5F3FF', frequency: 'weekly', notificationTime: '18:00:00', dayOfWeek: 4 },
  { key: 'bathsupplies', name: 'Reponer bano', code: 'RB', color: '#ECFCCB', frequency: 'weekly', notificationTime: '13:00:00', dayOfWeek: 1 },
  { key: 'pet', name: 'Zona mascota', code: 'ZM', color: '#FDF2F8', frequency: 'daily', notificationTime: '19:30:00' },
]

interface HouseholdData {
  id: string
  name: string
  adminUserId: string
  inviteCode: string
  adminName: string
  members: { id: string; name: string }[]
}

type AppPlan = 'free' | 'hogar' | 'familia'

function getCustomTaskLimit(plan: AppPlan): number {
  if (plan === 'hogar') return 5
  if (plan === 'familia') return 30
  return 0
}

function getTaskCode(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TT'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function getTaskThumbColor(name: string): string {
  const palette = ['#DBEAFE', '#DCFCE7', '#FCE7F3', '#FEF3C7', '#E0E7FF', '#E0F2FE', '#F5F3FF', '#FFE4E6']
  const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return palette[hash % palette.length]
}

export default function HouseholdScreen() {
  const { onMenuPress } = useMenuContext()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [household, setHousehold] = useState<HouseholdData | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedTaskNames, setSelectedTaskNames] = useState<string[]>([])
  const [customTasks, setCustomTasks] = useState<Array<{ id: string; name: string; frequency: 'daily' | 'weekly' | 'monthly' }>>([])
  const [plan, setPlan] = useState<AppPlan>('free')
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
          .select('user_id, users(name, email)')
          .eq('household_id', membership.household_id)
          .eq('status', 'active'),
      ])

      if (!hh) {
        setHousehold(null)
        return
      }

      const members: { id: string; name: string }[] =
        (memberRows ?? []).map((row: any) => ({
          id: row.user_id,
          name: row.users?.name ?? row.users?.email?.split('@')[0] ?? 'Miembro',
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
      Alert.alert('Codigo requerido', 'Escribe el codigo de invitacion.')
      return
    }
    if (!currentUserId) return
    setSaving(true)
    try {
      const { data: found, error: findError } = await supabase
        .from('households')
        .select('id, name')
        .eq('invite_code', code)
        .maybeSingle()

      if (findError || !found) {
        Alert.alert('Codigo invalido', 'No encontramos un hogar con ese codigo.')
        return
      }

      // Check if already member
      const { data: existing } = await supabase
        .from('household_members')
        .select('id, status')
        .eq('household_id', found.id)
        .eq('user_id', currentUserId)
        .maybeSingle()

      if (existing) {
        if (existing.status === 'active') {
          Alert.alert('Ya eres miembro', `Ya formas parte de "${found.name}".`)
          return
        }
        // Re-activate if removed
        await supabase
          .from('household_members')
          .update({ status: 'active', joined_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        const { error: joinError } = await supabase
          .from('household_members')
          .insert({ household_id: found.id, user_id: currentUserId, status: 'active', joined_at: new Date().toISOString() })

        if (joinError) {
          Alert.alert('Error', joinError.message)
          return
        }
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

    if (household.adminUserId === currentUserId) {
      Alert.alert('Eres el administrador', 'No puedes salirte siendo jefe. Transfiere el rol o elimina el hogar.')
      return
    }

    Alert.alert(
      'Salir del hogar',
      `¿Salir de "${household.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            setSaving(true)
            try {
              const { error } = await supabase
                .from('household_members')
                .update({ status: 'removed' })
                .eq('household_id', household.id)
                .eq('user_id', currentUserId)

              if (error) {
                Alert.alert('Error', error.message)
                return
              }

              setHousehold(null)
              invalidateDashboardContextCache()
            } finally {
              setSaving(false)
            }
          },
        },
      ]
    )
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

  async function handleDeactivateTask(taskId: string | null, taskName: string) {
    if (!household || !currentUserId || household.adminUserId !== currentUserId) return
    setSaving(true)
    try {
      if (taskId) {
        const { error } = await supabase
          .from('tasks')
          .update({ is_active: false, deleted_at: new Date().toISOString() })
          .eq('id', taskId)
          .eq('household_id', household.id)
        if (error) { Alert.alert('Error', error.message); return }
      } else {
        const { error } = await supabase
          .from('tasks')
          .update({ is_active: false, deleted_at: new Date().toISOString() })
          .eq('household_id', household.id)
          .eq('name', taskName)
        if (error) { Alert.alert('Error', error.message); return }
      }
      await loadHouseholdTasks(household.id)
    } finally {
      setSaving(false)
    }
  }

  const isAdmin = household?.adminUserId === currentUserId
  const isProPlan = plan !== 'free'

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
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
          </View>
        </Reveal>

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
                      <Text style={styles.inviteCode}>{household.inviteCode}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
            </Reveal>

            {/* Members */}
            <Reveal delay={100}>
              <View style={styles.card}>
              <Text style={styles.cardTitle}>Miembros ({household.members.length})</Text>
              {household.members.map(m => (
                <View key={m.id} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, m.id === household.adminUserId && styles.memberAvatarAdmin]}>
                    <Text style={styles.memberAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.id === currentUserId ? `${m.name} (tú)` : m.name}</Text>
                    {m.id === household.adminUserId && (
                      <Text style={styles.memberRole}>Jefe de hogar</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
            </Reveal>

            <Reveal delay={110}>
              <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Tareas activas</Text>
                {isAdmin && (
                  <Pressable onPress={() => router.push('/(app)/household/configure-tasks')}>
                    <Text style={styles.linkText}>Gestionar</Text>
                  </Pressable>
                )}
              </View>

              {selectedTaskNames.length === 0 ? (
                <Text style={styles.cardSubtitle}>
                  No hay tareas activas aún.{isAdmin ? ' Usa "Gestionar" para asignar tareas al hogar.' : ' El jefe del hogar puede asignarlas.'}
                </Text>
              ) : (
                <View style={styles.activeTaskList}>
                  {selectedTaskNames.map(name => {
                    const custom = customTasks.find(t => t.name === name)
                    const template = TASK_TEMPLATES.find(t => t.name === name)
                    const code = template?.code ?? getTaskCode(name)
                    const color = template?.color ?? getTaskThumbColor(name)
                    const freq = custom?.frequency ?? template?.frequency ?? 'daily'
                    const freqLabel = freq === 'daily' ? 'Diaria' : freq === 'weekly' ? 'Semanal' : 'Mensual'
                    return (
                      <View key={name} style={styles.activeTaskRow}>
                        <View style={[styles.activeTaskThumb, { backgroundColor: color }]}>
                          <Text style={styles.activeTaskThumbText}>{code}</Text>
                        </View>
                        <View style={styles.activeTaskInfo}>
                          <Text style={styles.activeTaskName}>{name}</Text>
                          <Text style={styles.activeTaskFreq}>{freqLabel}</Text>
                        </View>
                        {isAdmin && (
                          <Pressable
                            style={[styles.deactivateButton, saving && styles.buttonDisabled]}
                            onPress={() => handleDeactivateTask(custom?.id ?? null, name)}
                            disabled={saving}
                          >
                            <Text style={styles.deactivateButtonText}>Quitar</Text>
                          </Pressable>
                        )}
                      </View>
                    )
                  })}
                </View>
              )}

              {isAdmin && (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push('/(app)/household/configure-tasks')}
                >
                  <Text style={styles.primaryButtonText}>Asignar nuevas tareas</Text>
                </Pressable>
              )}
            </View>
            </Reveal>

            {/* Leave */}
            <Reveal delay={130}>
            {!isAdmin && (
              <Pressable
                style={[styles.dangerButton, saving && styles.buttonDisabled]}
                onPress={handleLeave}
                disabled={saving}
              >
                <Text style={styles.dangerButtonText}>Salir del hogar</Text>
              </Pressable>
            )}

            {isAdmin && (
              <View style={styles.adminNote}>
                <Text style={styles.adminNoteText}>Eres el jefe de hogar. Para salirte, primero transfiere el rol a otro miembro.</Text>
              </View>
            )}
            </Reveal>
          </>
        ) : (
          <>
            {/* Create */}
            <Reveal delay={90}>
              <View style={styles.card}>
              <Text style={styles.cardTitle}>Crear hogar</Text>
              <Text style={styles.cardSubtitle}>Elige un nombre y comparte el código con tu familia.</Text>
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
            </View>
            </Reveal>

            {/* Join */}
            <Reveal delay={100}>
              <View style={styles.card}>
              <Text style={styles.cardTitle}>Unirme con código</Text>
              <Text style={styles.cardSubtitle}>Pídele a tu jefe de hogar el código de 8 caracteres.</Text>
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
    backgroundColor: '#5EEAD4',
    opacity: 0.08,
  },
  bgShapeBottom: {
    position: 'absolute',
    bottom: 85,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: BorderRadius.full,
    backgroundColor: '#CCFBF1',
    opacity: 0.06,
  },
  headerCard: {
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#164E63',
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
    color: '#5EEAD4',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#CBD5E1',
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
    backgroundColor: '#C7D2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarAdmin: {
    backgroundColor: '#1E3A8A',
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
  activeTaskList: {
    gap: Spacing.xs,
  },
  activeTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  activeTaskThumb: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTaskThumbText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  activeTaskInfo: {
    flex: 1,
  },
  activeTaskName: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  activeTaskFreq: {
    color: Colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  deactivateButton: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  deactivateButtonText: {
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
  dangerButton: {
    borderWidth: 1.5,
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
  adminNote: {
    backgroundColor: '#ECFDF5',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    padding: Spacing.md,
  },
  adminNoteText: {
    color: '#0F766E',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
})
