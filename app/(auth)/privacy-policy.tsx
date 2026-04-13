import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { BorderRadius, Colors, Spacing } from '../../constants/theme'

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.title}>Politica de privacidad</Text>
        <Text style={styles.text}>
          MeToca usa tu correo, membresia de hogar y estado de tareas para operar la app.
          No vendemos datos personales. Las notificaciones se usan solo para recordatorios
          y eventos del hogar.
        </Text>
        <Text style={styles.text}>
          Puedes solicitar eliminacion de cuenta y datos escribiendo a soporte.
          Esta version MVP incluye texto provisional para pruebas internas.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  text: {
    color: Colors.text.secondary,
    fontSize: 14,
    lineHeight: 22,
  },
})
