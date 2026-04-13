import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { BorderRadius, Colors, Spacing } from '../../constants/theme'

export default function TermsOfUseScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.title}>Terminos de uso</Text>
        <Text style={styles.text}>
          El uso de MeToca implica aceptar distribucion automatica de tareas,
          visibilidad compartida de cumplimiento dentro del hogar y reglas de plan
          segun suscripcion activa.
        </Text>
        <Text style={styles.text}>
          Las suscripciones se renuevan automaticamente segun tienda y pueden
          cancelarse desde App Store o Google Play.
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
