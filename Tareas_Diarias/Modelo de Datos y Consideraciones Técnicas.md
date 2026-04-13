# Modelo de Datos y Consideraciones Técnicas
## App de Distribución de Tareas del Hogar

> Documento técnico para el equipo de desarrollo.
> Última actualización: 21-03-2026

---

## Principios de Diseño Aplicados

- **UUIDs** como PK en todas las tablas — evita enumeración de IDs y es estándar en apps móviles.
- **Soft delete** (`deleted_at`) en todas las entidades principales — necesario para cumplir con la política de "eliminar mi cuenta" de App Store y Google Play.
- **Auditoría** (`created_at`, `updated_at`) en todas las tablas.
- **Separación de identidad y membresía** — un usuario puede pertenecer a más de un hogar.
- Las suscripciones se validan contra las APIs oficiales de Apple y Google (no procesamiento propio dentro de la app nativa).

---

## Diagrama de Entidades

```
User ─────────────────────── HouseholdMember ─────── Household
 │                                                        │
 └── TaskExecution ←── TaskAssignment ←──────────── Task ┘
                                                          │
Subscription ──────────────────────────────── Household  │
                                                          │
NotificationLog ──────────── TaskExecution               │
                                                          │
MonthlyReport ─────────────────────────── Household ─────┘
```

---

## Definición de Tablas

### `users`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `name` | VARCHAR(100) | |
| `email` | VARCHAR(255) UNIQUE | |
| `phone` | VARCHAR(20) | Opcional |
| `push_token_fcm` | TEXT | Firebase — Android |
| `push_token_apns` | TEXT | Apple Push Notification Service — iOS |
| `platform` | ENUM(android, ios) | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP NULL | Soft delete |

---

### `households` (Hogares)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `name` | VARCHAR(100) | Ej: "Casa Martínez" |
| `admin_user_id` | UUID FK → users | Administrador del hogar |
| `invite_code` | VARCHAR(12) UNIQUE | Código para que otros se unan |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP NULL | |

---

### `household_members`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `household_id` | UUID FK → households | |
| `user_id` | UUID FK → users | |
| `status` | ENUM(invited, active, removed) | |
| `joined_at` | TIMESTAMP NULL | Fecha efectiva de ingreso al hogar |
| `created_at` | TIMESTAMP | |

---

### `tasks` (Definición de tarea)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `household_id` | UUID FK → households | |
| `name` | VARCHAR(150) | Ej: "Lavar la ropa" |
| `frequency` | ENUM(daily, weekly, monthly) | |
| `notification_time` | TIME | Hora del recordatorio |
| `day_of_week` | SMALLINT NULL | 0=Lun … 6=Dom — solo para `weekly` |
| `day_of_month` | SMALLINT NULL | 1–28 — solo para `monthly` |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP NULL | |

---

### `task_assignments` (Asignación mensual)
> Generada automáticamente el día 15 de cada mes para el mes siguiente.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `task_id` | UUID FK → tasks | |
| `household_id` | UUID FK → households | |
| `user_id` | UUID FK → users | Miembro asignado |
| `month` | CHAR(7) | Formato `YYYY-MM` |
| `created_at` | TIMESTAMP | |

**Índice único:** `(task_id, month)` — una tarea tiene un solo asignado por mes.

---

### `task_executions` (Cada ocurrencia real de la tarea)
> Una tarea diaria genera una ejecución por día. Una semanal, una por semana. Etc.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `task_assignment_id` | UUID FK → task_assignments | |
| `task_id` | UUID FK → tasks | |
| `assigned_to` | UUID FK → users | |
| `scheduled_date` | DATE | Día que corresponde ejecutarla |
| `scheduled_time` | TIME | |
| `status` | ENUM(pending, completed, missed) | |
| `completed_at` | TIMESTAMP NULL | Se llena cuando el usuario marca como hecha |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### `subscriptions`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `household_id` | UUID FK → households | |
| `plan` | ENUM(free, hogar, familia) | |
| `max_members` | SMALLINT | 2 / 5 / 10 según plan |
| `status` | ENUM(active, cancelled, expired) | |
| `platform` | ENUM(apple, google) | Origen de la compra |
| `platform_subscription_id` | TEXT | Receipt ID de Apple o Google |
| `started_at` | TIMESTAMP | |
| `expires_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### `monthly_reports`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `household_id` | UUID FK → households | |
| `month` | CHAR(7) | `YYYY-MM` |
| `total_tasks` | INTEGER | Total de ejecuciones esperadas en el mes |
| `completed_tasks` | INTEGER | |
| `completion_rate` | DECIMAL(5,2) | 0.00 – 100.00 |
| `detail` | JSONB | Desglose por miembro |
| `generated_at` | TIMESTAMP | Se genera el día 1 del mes siguiente |

---

### `task_swaps` (Intercambios de tareas entre miembros)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `requester_id` | UUID FK → users | Quien solicita el intercambio |
| `target_id` | UUID FK → users | Quien recibe la solicitud |
| `requester_execution_id` | UUID FK → task_executions NULL | Tarea que cede el solicitante (puede ser nula si solo cede sin recibir) |
| `target_execution_id` | UUID FK → task_executions | Tarea que cede el receptor |
| `scope` | ENUM(daily, weekly, monthly) | Alcance del intercambio |
| `status` | ENUM(pending, accepted, rejected, cancelled) | |
| `requested_at` | TIMESTAMP | |
| `resolved_at` | TIMESTAMP NULL | |

---

### `notification_log`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `task_execution_id` | UUID FK → task_executions NULL | Nulo si es notificación de reporte o asignación |
| `type` | ENUM(task_reminder, second_reminder, assignment_published, monthly_report) | |
| `status` | ENUM(sent, delivered, failed) | |
| `sent_at` | TIMESTAMP | |

---

## Reglas de Negocio Reflejadas en el Modelo

| Regla | Cómo se implementa |
|---|---|
| Asignación el día 15 | Job programado que corre el día 15 y genera registros en `task_assignments` |
| Notificación desde la misma notificación | El status de `task_executions` se actualiza vía API con un solo tap |
| Tarea no realizada visible en dashboard | Query sobre `task_executions` con status `missed` o `pending` fuera de fecha |
| Un único recordatorio adicional | `notification_log` verifica que no exista un registro `second_reminder` previo para esa ejecución |
| Reporte mensual | Job que corre el día 1, agrega `task_executions` del mes anterior y genera `monthly_reports` |
| Límite de miembros por plan | Validación en backend al aceptar invitación contra `subscriptions.max_members` |

---

## Consideraciones Críticas para App Store (Apple) y Google Play

### Suscripciones — obligatorio

Ambas tiendas **exigen** que las compras dentro de la app nativa pasen por su sistema de pagos:

- **iOS:** Apple In-App Purchase (StoreKit 2)
- **Android:** Google Play Billing Library

Apple y Google retienen entre el **15% y 30%** de cada transacción (15% para ingresos anuales bajo USD 1M con el programa para pequeños desarrolladores).

**Consecuencia directa:** WebPay y Mercado Pago solo pueden usarse en una versión **web** de la app. Dentro de la app nativa, el pago va por StoreKit / Play Billing sí o sí, o la app es removida de la tienda.

El campo `platform_subscription_id` en `subscriptions` almacena el receipt que el backend debe validar contra la API de Apple (`verifyReceipt`) o Google (`purchases.subscriptions.get`) antes de activar el plan.

### Privacidad — requerimiento de ambas tiendas

| Requerimiento | Apple | Google |
|---|---|---|
| Privacy Nutrition Label | Obligatorio | No aplica igual |
| Política de privacidad pública | Obligatorio | Obligatorio |
| Declarar uso de notificaciones push | Obligatorio | Obligatorio |
| Flujo de eliminación de cuenta | Obligatorio (desde 2023) | Obligatorio (desde 2024) |

El **soft delete** (`deleted_at`) en las tablas principales cubre el requerimiento de eliminación de cuenta: se marcan los datos como eliminados y se puede implementar una purga diferida de los datos reales a los 30 días.

### Permisos de notificación push

- En iOS, el usuario debe **conceder permiso explícito** la primera vez. Si lo rechaza, no hay notificaciones.
- En Android 13+, también se requiere permiso explícito.
- El flujo de onboarding debe pedir este permiso en el momento correcto, con contexto claro de por qué se necesita — de lo contrario la tasa de aceptación cae significativamente.

### Revisión de apps

- Apple demora entre **1 y 3 días hábiles** en revisar una app nueva.
- Google demora entre **1 y 7 días** para la primera publicación.
- Ambas pueden rechazar la app si detectan funcionalidades de pago fuera de su sistema o políticas de privacidad incompletas.

---

## Pendientes Técnicos

- [ ] Definir stack tecnológico (backend, frontend móvil, base de datos, servicio de notificaciones)
- [ ] Diseñar el flujo de notificaciones push (job scheduler + FCM + APNS)
- [ ] Definir arquitectura de infraestructura (cloud provider, hosting)
- [ ] Diseñar el algoritmo de rotación de tareas
- [ ] Definir el flujo de onboarding y solicitud de permisos push
- [ ] Implementar validación de recibos de Apple y Google en backend
