import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../supabase'

const QUEUE_KEY = 'metoca:completion_queue'

interface CompletionQueueItem {
  executionId: string
  completedAt: string
}

/**
 * Marca una tarea como completada.
 * Si no hay conexión, encola la acción localmente y la sincroniza después.
 */
export async function markTaskCompleted(executionId: string): Promise<void> {
  const completedAt = new Date().toISOString()

  const { error } = await supabase
    .from('task_executions')
    .update({ status: 'completed', completed_at: completedAt })
    .eq('id', executionId)

  if (error) {
    // Sin conexión — guardar en cola local
    await enqueue({ executionId, completedAt })
  }
}

/**
 * Intenta sincronizar las acciones pendientes en la cola local.
 * Llamar cuando se detecta que la conexión se restableció.
 */
export async function syncPendingCompletions(): Promise<void> {
  const queue = await getQueue()
  if (queue.length === 0) return

  const failed: CompletionQueueItem[] = []

  for (const item of queue) {
    const { error } = await supabase
      .from('task_executions')
      .update({ status: 'completed', completed_at: item.completedAt })
      .eq('id', item.executionId)

    if (error) failed.push(item)
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed))
}

async function enqueue(item: CompletionQueueItem): Promise<void> {
  const queue = await getQueue()
  queue.push(item)
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

async function getQueue(): Promise<CompletionQueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}
