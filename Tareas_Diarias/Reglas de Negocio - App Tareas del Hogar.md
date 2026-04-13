# Reglas de Negocio — App de Distribución de Tareas del Hogar

> Documento vivo. Actualizar a medida que se toman nuevas decisiones.
> Última actualización: 21-03-2026

---

## 1. Contexto y Diferenciador

- **Mercado objetivo:** Latinoamérica, con Chile como mercado beta inicial.
- **Diferenciador principal:** Enfoque cultural en hogares latinoamericanos (estructura familiar, pagos locales, tono en español natural, no traducido).
- **Problema que resuelve:** La "no-ocurrencia" — las tareas no se hacen no por olvido sino porque nunca entran al radar mental del día.
- **Solución central:** Notificaciones push proactivas que empujan la tarea al usuario en el momento correcto, sin que tenga que ir a buscarla.

---

## 2. Estructura del Grupo (Hogar)

- Un usuario crea el hogar y se convierte en **Administrador**.
- El Administrador es el único con permisos para:
  - Editar/agregar/eliminar tareas
  - Invitar y remover miembros
  - Ver configuración del plan
- Los demás miembros son **invitados** — sin jerarquía visible entre ellos.
- El rol de Administrador no tiene etiqueta visible para los otros miembros (se evita conflicto de autoridad).
- La suscripción es **por hogar**, pagada por el Administrador. Los miembros invitados no pagan.

---

## 3. Tareas

- El Administrador define cada tarea con:
  - Nombre
  - Frecuencia: `diaria | semanal | mensual`
  - Horario de notificación (hora del día)
- Las tareas se distribuyen **automáticamente** entre los miembros del hogar.

---

## 4. Distribución y Asignación

- La distribución se realiza **mensualmente**.
- La asignación del mes siguiente se publica el **día 15 del mes en curso**, dando 15 días de anticipación para que los miembros puedan reorganizarse.
- El algoritmo de distribución para el MVP es **rotación fija**: las tareas rotan entre miembros de forma equitativa cada mes.
- Mejora futura: distribución por carga acumulada (el que menos hizo, recibe la siguiente).

---

## 5. Notificaciones

- Cada miembro recibe notificaciones **únicamente de sus tareas asignadas**.
- Las notificaciones son push, proactivas, en el horario definido para cada tarea.
- **Plan free:** la notificación abre la app → se muestra un anuncio → el usuario marca la tarea como hecha manualmente.
- **Planes pagos (Hogar / Familia):** la notificación incluye un botón "✓ Hecha" que marca la tarea sin abrir la app.
- Si la tarea no se marca: se emite un **único recordatorio adicional** a las 2 horas (no múltiples).
- Las tareas no realizadas quedan marcadas visiblemente como pendientes en el dashboard.
- La app **no verifica físicamente** si la tarea fue realizada. El control es social: el dashboard y el reporte mensual son visibles para todos los miembros del hogar.

---

## 6. Dashboard y Reportes

- Existe un **dashboard compartido** visible para todos los miembros del hogar.
- El dashboard muestra en tiempo real:
  - Tareas del mes y su estado (realizada / pendiente / no realizada)
  - Asignación por miembro
- Al finalizar cada mes se genera un **reporte mensual** con:
  - Porcentaje de cumplimiento del hogar (ej: "Este mes completaron el 78% de sus tareas")
  - Detalle por miembro
  - El tono es neutral/positivo, no acusatorio
- El reporte se entrega por **notificación push + email**.

---

## 7. Planes y Suscripción

> Pendiente validar con datos del INE (Censo Chile) el tamaño promedio de hogar.
> Dato estimado actual: promedio hogar Chile = 3,1 personas (Censo 2017), Santiago urbano ~2,8.

| Plan | Miembros incluidos | Precio estimado CLP/mes |
|---|---|---|
| **Gratis** | 2 | $0 |
| **Hogar** | 5 | ~$2.990 |
| **Familia** | 10 | ~$4.990 |

- El límite del plan Gratis (2 miembros) incentiva la conversión en hogares de 3+ personas.
- Métodos de pago para Chile: **WebPay, transferencia bancaria**. Mercado Pago como opción secundaria.
- Precio en CLP (no en USD) para evitar fricción por tipo de cambio.

---

## 8. Decisiones Pendientes

- [ ] Validar tamaño promedio de hogar en Chile con dato INE actualizado
- [ ] Definir si el día de publicación de asignaciones (día 15) es fijo o configurable por el Administrador
- [ ] Definir modelo de datos (Hogar → Miembros → Tareas → Asignaciones → Notificaciones)
- [~] Nombre tentativo: **MeToca** — tagline: *"Hogar Ordenado"* (pendiente confirmar definitivamente)
- [ ] Definir stack tecnológico

---

## 9. Monetización por Plan

| Plan | Monetización |
|---|---|
| **Free** | Publicidad (ads) mostrada al abrir la app desde una notificación |
| **Hogar / Familia** | Suscripción mensual — sin publicidad |

La diferencia de experiencia en notificaciones (botón directo vs. abrir app) actúa como argumento de venta natural hacia los planes pagos.

---

## 10. Fuera del Alcance del MVP

- Gamificación (puntos, rachas, rankings)
- Distribución por carga acumulada
- Integración con calendarios externos
- Soporte para empleada de casa particular como perfil especial
- Funcionalidad offline
- Expansión a otros países LATAM
