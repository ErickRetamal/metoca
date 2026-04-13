import { useEffect, useState } from 'react'
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { BorderRadius, Colors, Spacing, ShadowPresets } from '../../../constants/theme'
import { Reveal } from '../../../components/ui/reveal'
import { getIncomingSwapRequests, IncomingSwapRequest, respondToSwapRequest } from '../../../lib/swaps'

function formatTimestamp(value: string): string {
  const date = new Date(value)
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SwapInboxScreen() {
  const [requests, setRequests] = useState<IncomingSwapRequest[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadRequests = async () => {
    const data = await getIncomingSwapRequests()
    setRequests(data)
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const handleDecision = async (swapId: string, decision: 'accepted' | 'rejected') => {
    setProcessingId(swapId)
    await respondToSwapRequest(swapId, decision)
    setProcessingId(null)
    await loadRequests()

    Alert.alert(
      decision === 'accepted' ? 'Intercambio aceptado' : 'Intercambio rechazado',
      decision === 'accepted'
        ? 'Las tareas fueron actualizadas para este intercambio.'
        : 'La solicitud fue rechazada y las tareas se mantienen.'
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Reveal delay={0}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Flexibilidad</Text>
          <Text style={styles.title}>Solicitudes de intercambio</Text>
          <Text style={styles.subtitle}>Aquí recibirás solicitudes de otros miembros para intercambiar tareas.</Text>
        </View>
      </Reveal>

      {requests.length === 0 && (
        <Reveal delay={90}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin solicitudes pendientes</Text>
            <Text style={styles.emptyText}>Cuando otro miembro te pida un intercambio aparecera aqui.</Text>
          </View>
        </Reveal>
      )}

      {requests.map((request, index) => {
        const processing = processingId === request.id

        return (
          <Reveal key={request.id} delay={90 + index * 10}>
            <View style={styles.requestCard}>
              <Text style={styles.requestTitle}>{request.requesterName} quiere intercambiar</Text>
              <Text style={styles.requestText}>Tu tarea: {request.targetTaskName}</Text>
              <Text style={styles.requestText}>Por su tarea: {request.requesterTaskName}</Text>
              <Text style={styles.metaText}>Alcance: {request.scope}</Text>
              <Text style={styles.metaText}>Solicitado: {formatTimestamp(request.requestedAt)}</Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.rejectButton, processing && styles.disabledButton]}
                  disabled={processing}
                  onPress={() => handleDecision(request.id, 'rejected')}
                >
                  <Text style={styles.rejectText}>Rechazar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.acceptButton, processing && styles.disabledButton]}
                  disabled={processing}
                  onPress={() => handleDecision(request.id, 'accepted')}
                >
                  <Text style={styles.acceptText}>{processing ? 'Procesando...' : 'Aceptar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Reveal>
        )
      })}
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
    gap: Spacing.md,
  },
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.xs,
    ...ShadowPresets.soft,
  },
  eyebrow: {
    color: '#0EA5E9',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    color: Colors.text.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...ShadowPresets.soft,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: 14,
  },
  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...ShadowPresets.soft,
  },
  requestTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  requestText: {
    color: Colors.text.primary,
    fontSize: 14,
  },
  metaText: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  acceptButton: {
    flex: 1,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    ...ShadowPresets.primary,
  },
  rejectText: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  acceptText: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.55,
  },
})
