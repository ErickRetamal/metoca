# Flujo de Notificaciones Push
## App de Distribución de Tareas del Hogar

> Documento técnico y de producto.
> Última actualización: 21-03-2026

---

## Arquitectura General

```
pg_cron (Supabase) — corre a las 23:00
    → genera task_executions del día siguiente
    → encola notificaciones
        → Edge Function despacha via FCM
            → FCM entrega a Android
            → FCM → APNS entrega a iOS
                → Usuario recibe notificación
                    → Plan pago: botón "✓ Hecha" directo desde notificación
                    → Plan free: toca → abre app → ve anuncio → marca hecha
                        → API actualiza task_executions.status = completed
                    → No hace nada
                        → Edge Function envía segundo recordatorio (una vez)
                            → Si sigue sin hacerse → status = missed (23:55)
```

---

## Experiencia por Plan

| Plan | Experiencia de notificación |
|---|---|
| **Free** | Notificación simple → toca → abre la app → ve anuncio → marca como hecha |
| **Hogar / Familia** | Notificación con botón "✓ Hecha" → marca sin abrir la app |

**¿Por qué esta diferencia?**
- El plan free monetiza mediante publicidad — abrir la app es el momento de mostrar el anuncio.
- El botón directo en la notificación es una micro-comodidad real en algo que se usa a diario. Es un argumento de venta claro y honesto en el paywall: *"Con el plan Hogar marcás tus tareas sin abrir la app"*.
- La fricción mínima de abrir la app en free también genera un segundo de consciencia antes de marcar, lo que reduce el marcado impulsivo.

---

## Los 4 Tipos de Notificación

### 1. `task_reminder` — Recordatorio principal

**Plan free:**
> 🧺 **Hoy te toca: Lavar la ropa**
> Tocá para abrir la app y marcarla como hecha

**Plan pago:**
> 🧺 **Hoy te toca: Lavar la ropa**
> [✓ Hecha]

- Se envía en el `notification_time` definido para la tarea
- Plan pago: acción directa desde notificación → `status = completed`
- Plan free: abre la app → muestra anuncio → el usuario marca manualmente

---

### 2. `second_reminder` — Segundo recordatorio

> **"¿Ya lavaste la ropa? Aún está pendiente 👀"**

- Se envía **2 horas después** del recordatorio principal si no fue marcada
- Se envía **una sola vez** — el `notification_log` verifica que no exista ya un `second_reminder` para esa ejecución antes de enviarlo
- Misma diferencia por plan (botón directo solo en planes pagos)
- Si no se marca antes de las 23:55 → `status = missed`

---

### 3. `assignment_published` — Publicación del mes

> 📋 **Ya están tus tareas de abril**
> El 15 de marzo ya podés ver lo que te toca el mes que viene

- Se envía el **día 15 de cada mes** cuando pg_cron corre la distribución mensual
- Al tocarla abre directamente la vista del mes siguiente
- Se envía igual a todos los planes

---

### 4. `monthly_report` — Reporte mensual

> 📊 **El resumen de marzo está listo**
> Tu hogar completó el 78% de las tareas este mes

- Se envía el **día 1 de cada mes**
- Al tocarla abre directamente la pantalla del reporte mensual
- Se envía igual a todos los planes
- También llega por **email**

---

## Jobs Programados (pg_cron en Supabase)

### Job nocturno — 23:00 (preparación del día siguiente)
```
Para cada task_assignment activo que corresponda al día siguiente:
    1. Crear registro en task_executions con status = pending
    2. Encolar notificación tipo task_reminder para el horario definido
    3. Encolar second_reminder para (horario definido + 2 horas)
```
Las notificaciones del día se preparan **la noche anterior** — el sistema es más estable y predecible.

### Job de cierre — 23:55 (cierre del día)
```
Para cada task_execution del día con status = pending:
    → Actualizar status = missed
```
Cierra el día limpiamente y alimenta el dashboard y el reporte mensual.

### Job del día 15 — 09:00 (asignación mensual)
```
Para cada tarea activa del hogar:
    → Correr algoritmo de rotación
    → Generar registros en task_assignments para el mes siguiente
    → Encolar notificación tipo assignment_published para cada miembro
```

### Job del día 1 — 09:00 (reporte mensual)
```
Para cada hogar activo:
    → Agregar task_executions del mes anterior
    → Calcular completion_rate
    → Generar registro en monthly_reports
    → Encolar notificación tipo monthly_report para cada miembro
    → Enviar email de reporte
```

---

## Manejo del Marcado sin Verificación Física

La app **no puede verificar** si la tarea fue realmente realizada — no requiere fotos, geolocalización ni ninguna otra comprobación invasiva. El control es social y transparente:

| Mecanismo | Cómo actúa |
|---|---|
| **Dashboard grupal en tiempo real** | Todos los miembros ven el estado de cada tarea. Si alguien marca siempre "Hecha" pero el hogar sigue sucio, la transparencia hace visible el problema. |
| **Reporte mensual por miembro** | Muestra el historial de cumplimiento de cada integrante a lo largo del mes. Patrones de comportamiento se vuelven evidentes. |
| **No sobre-ingenierizar** | El 90% de los usuarios usará la app de buena fe. Agregar verificación obligatoria para el 10% restante arruina la experiencia de todos. |

---

## Consideraciones Técnicas por Plataforma

| Situación | iOS | Android |
|---|---|---|
| Usuario rechazó permiso de push | No recibe nada — la app detecta el estado y muestra un banner interno invitando a activarlos | Igual |
| App desinstalada | FCM/APNS devuelve error de token inválido → backend elimina `push_token_*` del usuario | Igual |
| Token expirado o rotado | FCM notifica al backend via callback → se actualiza el token | Igual |
| Acción directa desde notificación | Soportado via Notification Actions | Soportado, más flexible |
| Sin conexión al marcar "Hecha" | La acción se guarda en cola local (AsyncStorage) y sincroniza al recuperar red | Igual |

**El caso de sin conexión es crítico:** si el usuario toca "Hecha" y la acción no se registra por falta de red, el usuario cree que marcó y no fue así. Eso destruye la confianza en la app. Se resuelve con una cola local de sincronización en el dispositivo.

---

## Lógica de Validación del Plan Antes de Enviar

El backend verifica el plan activo del hogar antes de construir la notificación:

```
Si household.subscription.plan == 'free':
    → Enviar notificación sin action buttons
Si household.subscription.plan == 'hogar' o 'familia':
    → Enviar notificación con action button "✓ Hecha"
```

La verificación ocurre en la **Edge Function de despacho**, no en el dispositivo — así no se puede manipular desde el cliente.

---

## Pendientes

- [ ] Definir si el segundo recordatorio es siempre a las +2 horas o configurable por el administrador
- [ ] Definir el proveedor de email para el reporte mensual (ej: Resend, SendGrid)
- [ ] Implementar cola local de sincronización en el dispositivo (AsyncStorage)
- [ ] Implementar callback de tokens inválidos de FCM para limpiar la base de datos
- [ ] Definir el comportamiento cuando el usuario no ha otorgado permiso de push (banner interno)
