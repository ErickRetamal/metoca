import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { BorderRadius, Colors, ShadowPresets, Spacing } from '../../../constants/theme'
import { HamburgerButton } from '../../../components/dashboard/side-menu'
import { useMenuContext } from '../../../lib/menu-context'
import { supabase } from '../../../lib/supabase'
import { CURRENT_PLAN, getCurrentPlanAsync } from '../../../lib/dashboard'
import { goToPaywall } from '../../../lib/navigation'
import { SubscriptionPlan } from '../../../types'
import { Reveal } from '../../../components/ui/reveal'

type GenderValue = 'masculino' | 'femenino' | 'otro' | 'prefiero_no_decir'

const AVATAR_COLORS = ['#1E3A8A', '#7C3AED', '#0F766E', '#BE123C', '#0369A1'] as const
type AvatarColor = typeof AVATAR_COLORS[number]

function getPlanLabel(plan: SubscriptionPlan): string {
  if (plan === 'family') return 'Familia'
  if (plan === 'household') return 'Hogar'
  return 'Gratis'
}

function getFullName(firstName: string | null, lastName: string | null, fallbackEmail?: string): string {
  const full = `${firstName ?? ''} ${lastName ?? ''}`.trim()
  if (full) return full

  if (fallbackEmail) {
    const [name] = fallbackEmail.split('@')
    if (name) return name
  }

  return 'Usuario'
}

function getGenderLabel(gender: string | null): string {
  if (gender === 'femenino') return 'Femenino'
  if (gender === 'masculino') return 'Masculino'
  if (gender === 'otro') return 'Otro'
  return 'Prefiero no decir'
}

function normalizeAvatarInitial(value: string, fallback?: string): string {
  const cleaned = value.trim().charAt(0).toUpperCase()
  if (cleaned) return cleaned
  return fallback?.trim().charAt(0).toUpperCase() || 'U'
}

function resolveAvatarColor(rawColor: string | undefined | null): AvatarColor {
  if (rawColor && AVATAR_COLORS.includes(rawColor as AvatarColor)) {
    return rawColor as AvatarColor
  }

  return AVATAR_COLORS[0]
}

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('Usuario')
  const [firstName, setFirstName] = useState<string>('')
  const [lastName, setLastName] = useState<string>('')
  const [gender, setGender] = useState<string | null>(null)
  const [avatarInitial, setAvatarInitial] = useState('U')
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(AVATAR_COLORS[0])
  const [draftFirstName, setDraftFirstName] = useState('')
  const [draftLastName, setDraftLastName] = useState('')
  const [draftGender, setDraftGender] = useState<GenderValue>('prefiero_no_decir')
  const [draftAvatarInitial, setDraftAvatarInitial] = useState('U')
  const [draftAvatarColor, setDraftAvatarColor] = useState<AvatarColor>(AVATAR_COLORS[0])
  const [plan, setPlan] = useState<SubscriptionPlan>(CURRENT_PLAN)
  const [isInHousehold, setIsInHousehold] = useState(false)
  const [householdName, setHouseholdName] = useState('')
  const { onMenuPress } = useMenuContext()

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      const [{ data: userData }, currentPlan] = await Promise.all([
        supabase.auth.getUser(),
        getCurrentPlanAsync(),
      ])

      if (!mounted) return

      const userEmail = userData.user?.email ?? ''
      const nextUserId = userData.user?.id

      setUserId(nextUserId ?? null)

      if (nextUserId) {
        const [{ data: dbUser }, { data: membership }] = await Promise.all([
          supabase
            .from('users')
            .select('name, first_name, last_name, gender')
            .eq('id', nextUserId)
            .maybeSingle(),
          supabase
            .from('household_members')
            .select('household_id, households(name)')
            .eq('user_id', nextUserId)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle(),
        ])

        if (!mounted) return

        const dbFirstName = dbUser?.first_name ?? null
        const dbLastName = dbUser?.last_name ?? null
        const fallbackFirst = userData.user?.user_metadata?.first_name as string | undefined
        const fallbackLast = userData.user?.user_metadata?.last_name as string | undefined
        const fallbackGender = userData.user?.user_metadata?.gender as string | undefined
        const fallbackAvatarInitial = userData.user?.user_metadata?.avatar_initial as string | undefined
        const fallbackAvatarColor = userData.user?.user_metadata?.avatar_color as string | undefined

        const nextFirstName = dbFirstName ?? fallbackFirst ?? ''
        const nextLastName = dbLastName ?? fallbackLast ?? ''

        setFirstName(nextFirstName)
        setLastName(nextLastName)
        setGender(dbUser?.gender ?? fallbackGender ?? null)
        setDraftFirstName(nextFirstName)
        setDraftLastName(nextLastName)
        setDraftGender((dbUser?.gender ?? fallbackGender ?? 'prefiero_no_decir') as GenderValue)
        const resolvedName = getFullName(nextFirstName, nextLastName, userEmail)
        const resolvedInitial = normalizeAvatarInitial(fallbackAvatarInitial ?? '', resolvedName)
        const resolvedColor = resolveAvatarColor(fallbackAvatarColor)

        setAvatarInitial(resolvedInitial)
        setDraftAvatarInitial(resolvedInitial)
        setAvatarColor(resolvedColor)
        setDraftAvatarColor(resolvedColor)
        setDisplayName(resolvedName)

        const linkedHouseholdName = (membership as any)?.households?.name ?? ''
        setIsInHousehold(Boolean((membership as any)?.household_id))
        setHouseholdName(linkedHouseholdName)
      } else {
        const resolvedName = getFullName(null, null, userEmail)
        const fallbackAvatarInitial = userData.user?.user_metadata?.avatar_initial as string | undefined
        const fallbackAvatarColor = userData.user?.user_metadata?.avatar_color as string | undefined

        setDisplayName(resolvedName)
        setAvatarInitial(normalizeAvatarInitial(fallbackAvatarInitial ?? '', resolvedName))
        setDraftAvatarInitial(normalizeAvatarInitial(fallbackAvatarInitial ?? '', resolvedName))
        setAvatarColor(resolveAvatarColor(fallbackAvatarColor))
        setDraftAvatarColor(resolveAvatarColor(fallbackAvatarColor))
        setDraftFirstName('')
        setDraftLastName('')
        setDraftGender('prefiero_no_decir')
        setIsInHousehold(false)
        setHouseholdName('')
      }

      setEmail(userEmail)
      setPlan(currentPlan)
      setLoading(false)
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [])

  const performSignOut = async () => {
    if (signingOut) return

    setSigningOut(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })

      if (error) {
        Alert.alert('No se pudo cerrar sesion', error.message)
        return
      }

      router.replace('/(auth)/welcome')
    } finally {
      setSigningOut(false)
    }
  }

  const handleSignOut = async () => {
    if (signingOut) return

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm('Quieres cerrar sesion ahora?')
        : true

      if (!confirmed) return
      await performSignOut()
      return
    }

    Alert.alert(
      'Cerrar sesion',
      'Quieres cerrar sesion ahora?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesion',
          style: 'destructive',
          onPress: () => {
            void performSignOut()
          },
        },
      ]
    )
  }

  const handleCancelEdit = () => {
    setDraftFirstName(firstName)
    setDraftLastName(lastName)
    setDraftGender((gender ?? 'prefiero_no_decir') as GenderValue)
    setDraftAvatarInitial(avatarInitial)
    setDraftAvatarColor(avatarColor)
    setIsEditing(false)
  }

  const handleSaveProfile = async () => {
    if (!userId) {
      Alert.alert('No se pudo guardar', 'No encontramos el usuario actual.')
      return
    }

    const nextFirstName = draftFirstName.trim()
    const nextLastName = draftLastName.trim()
    const nextAvatarInitial = normalizeAvatarInitial(draftAvatarInitial, `${nextFirstName} ${nextLastName}`)

    if (!nextFirstName || !nextLastName) {
      Alert.alert('Faltan datos', 'Nombre y apellido son obligatorios.')
      return
    }

    const fullName = `${nextFirstName} ${nextLastName}`.trim()

    setSavingProfile(true)

    const [{ error: profileError }, { error: authError }] = await Promise.all([
      supabase
        .from('users')
        .update({
          first_name: nextFirstName,
          last_name: nextLastName,
          gender: draftGender,
          name: fullName,
        })
        .eq('id', userId),
      supabase.auth.updateUser({
        data: {
          first_name: nextFirstName,
          last_name: nextLastName,
          gender: draftGender,
          name: fullName,
          avatar_initial: nextAvatarInitial,
          avatar_color: draftAvatarColor,
        },
      }),
    ])

    setSavingProfile(false)

    if (profileError || authError) {
      Alert.alert('No se pudo guardar', profileError?.message ?? authError?.message ?? 'Error inesperado.')
      return
    }

    setFirstName(nextFirstName)
    setLastName(nextLastName)
    setGender(draftGender)
    setAvatarInitial(nextAvatarInitial)
    setAvatarColor(draftAvatarColor)
    setDraftAvatarInitial(nextAvatarInitial)
    setDisplayName(fullName)
    setIsEditing(false)
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgShapeTop} />
      <View style={styles.bgShapeBottom} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal>
        <View style={styles.heroCard}>
          <View style={styles.heroMenuRow}>
            <HamburgerButton onPress={onMenuPress} />
            <Text style={styles.eyebrow}>Identidad</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>

          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{email || 'Sin correo disponible'}</Text>

          <Pressable style={styles.planPill} onPress={() => goToPaywall('profile-plan-pill')}>
            <Text style={styles.planPillText}>Plan {getPlanLabel(plan)}</Text>
          </Pressable>
        </View>
        </Reveal>

        <Reveal delay={90}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cuenta</Text>

            {!isEditing ? (
              <Pressable style={styles.editButton} onPress={() => setIsEditing(true)}>
                <Text style={styles.editButtonText}>Editar</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.cancelEditButton} onPress={handleCancelEdit}>
                <Text style={styles.cancelEditButtonText}>Cancelar</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Correo</Text>
            <Text style={styles.infoValue}>{email || '-'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nombre</Text>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={draftFirstName}
                onChangeText={setDraftFirstName}
                placeholder="Nombre"
                placeholderTextColor={Colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            ) : (
              <Text style={styles.infoValue}>{firstName || '-'}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Apellido</Text>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={draftLastName}
                onChangeText={setDraftLastName}
                placeholder="Apellido"
                placeholderTextColor={Colors.muted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            ) : (
              <Text style={styles.infoValue}>{lastName || '-'}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Genero</Text>
            {isEditing ? (
              <View style={styles.genderRow}>
                <Pressable
                  style={[styles.genderChip, draftGender === 'femenino' && styles.genderChipActive]}
                  onPress={() => setDraftGender('femenino')}
                >
                  <Text style={[styles.genderChipText, draftGender === 'femenino' && styles.genderChipTextActive]}>Femenino</Text>
                </Pressable>
                <Pressable
                  style={[styles.genderChip, draftGender === 'masculino' && styles.genderChipActive]}
                  onPress={() => setDraftGender('masculino')}
                >
                  <Text style={[styles.genderChipText, draftGender === 'masculino' && styles.genderChipTextActive]}>Masculino</Text>
                </Pressable>
                <Pressable
                  style={[styles.genderChip, draftGender === 'otro' && styles.genderChipActive]}
                  onPress={() => setDraftGender('otro')}
                >
                  <Text style={[styles.genderChipText, draftGender === 'otro' && styles.genderChipTextActive]}>Otro</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.infoValue}>{getGenderLabel(gender)}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Inicial avatar</Text>
            {isEditing ? (
              <TextInput
                style={styles.editInput}
                value={draftAvatarInitial}
                onChangeText={value => setDraftAvatarInitial(normalizeAvatarInitial(value, displayName))}
                placeholder="Inicial"
                placeholderTextColor={Colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={1}
              />
            ) : (
              <Text style={styles.infoValue}>{avatarInitial}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Color avatar</Text>
            {isEditing ? (
              <View style={styles.avatarColorRow}>
                {AVATAR_COLORS.map(color => (
                  <Pressable
                    key={color}
                    style={[
                      styles.avatarColorChip,
                      { backgroundColor: color },
                      draftAvatarColor === color && styles.avatarColorChipActive,
                    ]}
                    onPress={() => setDraftAvatarColor(color)}
                  />
                ))}
              </View>
            ) : (
              <View style={[styles.avatarColorPreview, { backgroundColor: avatarColor }]} />
            )}
          </View>

          <Pressable style={styles.infoRow} onPress={() => goToPaywall('profile-subscription-row')}>
            <Text style={styles.infoLabel}>Suscripcion</Text>
            <Text style={styles.infoValue}>{getPlanLabel(plan)}</Text>
          </Pressable>

          <Pressable style={styles.infoRow} onPress={() => router.push('/(app)/household')}>
            <Text style={styles.infoLabel}>Mi hogar</Text>
            <Text style={styles.infoValue}>{isInHousehold ? (householdName || 'Vinculado') : 'No vinculado'}</Text>
          </Pressable>

          {isEditing && (
            <Pressable
              style={[styles.saveButton, savingProfile && styles.saveButtonDisabled]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile
                ? <ActivityIndicator color={Colors.text.inverse} />
                : <Text style={styles.saveButtonText}>Guardar cambios</Text>
              }
            </Pressable>
          )}
        </View>
        </Reveal>

        <Reveal delay={160}>
          <Pressable
            style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            <Text style={styles.signOutEyebrow}>Seguridad</Text>
            {signingOut
              ? <ActivityIndicator color={Colors.text.inverse} />
              : <Text style={styles.signOutText}>Cerrar sesion</Text>
            }
          </Pressable>
        </Reveal>
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
  bgShapeTop: {
    position: 'absolute',
    top: -70,
    left: -75,
    width: 230,
    height: 230,
    borderRadius: BorderRadius.full,
    backgroundColor: '#DBEAFE',
  },
  bgShapeBottom: {
    position: 'absolute',
    bottom: 80,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: BorderRadius.full,
    backgroundColor: '#E0E7FF',
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    ...ShadowPresets.card,
  },
  heroMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
  },
  eyebrow: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: BorderRadius.full,
    backgroundColor: '#1E3A8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.text.inverse,
    fontSize: 30,
    fontWeight: '800',
  },
  name: {
    fontSize: 23,
    fontWeight: '700',
    color: '#F8FAFC',
    textTransform: 'capitalize',
  },
  email: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  planPill: {
    marginTop: Spacing.xs,
    backgroundColor: 'rgba(191, 219, 254, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.35)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  planPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DBEAFE',
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...ShadowPresets.soft,
  },
  sectionTitle: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  editButtonText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelEditButton: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
  },
  cancelEditButtonText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    borderWidth: 1,
    borderColor: '#E6EDF7',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    backgroundColor: '#FFFFFF',
    gap: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  editInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text.primary,
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  genderChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  genderChipActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EEF2FF',
  },
  genderChipText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  genderChipTextActive: {
    color: Colors.primary,
  },
  avatarColorRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  avatarColorChip: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarColorChipActive: {
    borderColor: '#111827',
  },
  avatarColorPreview: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
  },
  saveButton: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    ...ShadowPresets.primary,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: Colors.text.inverse,
    fontSize: 14,
    fontWeight: '700',
  },
  signOutButton: {
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 2,
    ...ShadowPresets.danger,
  },
  signOutButtonDisabled: {
    opacity: 0.7,
  },
  signOutEyebrow: {
    color: '#FECACA',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  signOutText: {
    color: Colors.text.inverse,
    fontSize: 15,
    fontWeight: '700',
  },
})
