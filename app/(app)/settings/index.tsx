import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { BorderRadius, Colors, ShadowPresets, Spacing } from '../../../constants/theme'
import { goToPaywall } from '../../../lib/navigation'
import { CollapsibleCard } from '../../../components/ui/collapsible-card'
import { Reveal } from '../../../components/ui/reveal'
import { HamburgerButton } from '../../../components/dashboard/side-menu'
import { useMenuContext } from '../../../lib/menu-context'

const SETTINGS_ITEMS = [
  { title: 'Notificaciones', subtitle: 'Configura recordatorios y avisos de tareas.' },
  { title: 'Privacidad', subtitle: 'Controla que informacion compartes con tu hogar.' },
  { title: 'Suscripcion', subtitle: 'Administra tu plan y opciones de facturacion.' },
  { title: 'Ayuda', subtitle: 'Contacta soporte o revisa preguntas frecuentes.' },
] as const

export default function SettingsScreen() {
  const { onMenuPress } = useMenuContext()
  return (
    <View style={styles.container}>
      <View style={styles.bgShapeTop} />
      <View style={styles.bgShapeBottom} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal>
        <View style={styles.headerCard}>
          <View style={styles.headerMenuRow}>
            <HamburgerButton onPress={onMenuPress} />
            <Text style={styles.eyebrow}>MeToca</Text>
          </View>
          <Text style={styles.title}>Configuracion</Text>
          <Text style={styles.subtitle}>Ajusta tu cuenta y preferencias desde un solo lugar.</Text>
        </View>
        </Reveal>

        <Reveal delay={90}>
        <View style={styles.listCard}>
          <CollapsibleCard
            title="Preferencias"
            subtitle="Notificaciones, privacidad, suscripción y ayuda."
          >
            {SETTINGS_ITEMS.map(item => (
              <Pressable
                key={item.title}
                style={styles.itemRow}
                onPress={() => {
                  if (item.title === 'Suscripcion') {
                    goToPaywall('settings-subscription-item')
                  }
                }}
              >
                <Text style={styles.itemEyebrow}>{item.title === 'Suscripcion' ? 'Plan' : 'Preferencia'}</Text>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
              </Pressable>
            ))}
          </CollapsibleCard>
        </View>
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
    backgroundColor: '#E0E7FF',
  },
  bgShapeBottom: {
    position: 'absolute',
    bottom: 85,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: BorderRadius.full,
    backgroundColor: '#DBEAFE',
  },
  headerCard: {
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...ShadowPresets.card,
  },  headerMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },  eyebrow: {
    color: '#93C5FD',
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
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...ShadowPresets.soft,
  },
  itemRow: {
    borderWidth: 1,
    borderColor: '#E5EDF6',
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: Spacing.sm + 2,
    gap: 4,
  },
  itemEyebrow: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  itemTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  itemSubtitle: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
})
