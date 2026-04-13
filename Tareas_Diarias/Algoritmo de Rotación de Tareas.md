# Algoritmo de Rotación de Tareas
## App de Distribución de Tareas del Hogar

> Documento técnico y de producto.
> Última actualización: 21-03-2026

---

## Principio Base

La rotación es **circular y equitativa**. Las tareas avanzan un paso en el círculo de miembros cada mes. A largo plazo todos hacen todas las tareas, y nadie puede elegir solo las fáciles.

---

## Rotación Circular (Sliding Window)

### Ejemplo con 4 tareas y 2 miembros (2 tareas cada uno)

| Mes | Ana | Pedro |
|---|---|---|
| Enero | T1, T2 | T3, T4 |
| Febrero | T2, T3 | T4, T1 |
| Marzo | T3, T4 | T1, T2 |
| Abril | T4, T1 | T2, T3 |
| Mayo | vuelve a Enero | |

---

## Reglas por Caso

### 1. Tarea sobrante (número de tareas no divisible entre miembros)

La tarea sobrante rota mensualmente entre los miembros, equilibrando la carga:

**Ejemplo — 5 tareas, 2 miembros:**

| Mes | Ana | Pedro |
|---|---|---|
| Enero | T1, T2, T3 (3 tareas) | T4, T5 (2 tareas) |
| Febrero | T3, T4 (2 tareas) | T5, T1, T2 (3 tareas) |
| Marzo | T2, T3, T4 (3 tareas) | T5, T1 (2 tareas) |

La carga extra alterna entre los miembros mes a mes.

---

### 2. Nueva tarea agregada por el Administrador

El administrador define al agregar la tarea:

**a) ¿Cuándo entra?**
- `Rotación actual` → entra este mes, se asigna a un miembro definido por el admin
- `Siguiente rotación` → entra el mes que viene, se incorpora al círculo normalmente

**b) ¿Quién la ejecuta primero?** (solo si entra en rotación actual)
- El admin elige el primer asignado manualmente
- Ese miembro recibe una notificación especial: *"Se agregó una nueva tarea a tu lista: [nombre de tarea]"*
- El mes siguiente, la tarea entra al círculo como cualquier otra y continúa rotando

**Registro:** el campo `created_by` en `tasks` y la fecha de creación permiten identificar tareas de incorporación reciente para el historial.

---

### 3. Nuevo miembro del hogar

El nuevo miembro **no entra a la rotación actual** — siempre ingresa en la siguiente rotación (mes siguiente).

**Durante el mes en que ingresa:**
- No recibe tareas asignadas automáticamente
- Puede participar vía **solicitud de intercambio** (ver sección siguiente)
- El administrador puede asignarle tareas manualmente si lo necesita

**¿Por qué no redistribuir inmediatamente?**
Redistribuir tareas a mitad de mes genera confusión — alguien que ya hizo su tarea podría ver que le cambiaron la asignación. Es más limpio esperar al ciclo siguiente.

---

### 4. Tarea eliminada

- La tarea se marca como `is_active = false` (soft delete lógico)
- Sigue apareciendo en el historial y reportes pasados
- **No afecta la rotación actual** — se excluye del círculo a partir del mes siguiente
- Las `task_executions` pendientes de esa tarea en el mes actual se mantienen hasta fin de mes

---

### 5. Hogar con un solo miembro

- Recibe todas las tareas
- No hay rotación
- Funciona igual que cualquier hogar en todo lo demás (notificaciones, dashboard, reportes)

---

## Sistema de Intercambio de Tareas

Permite que un miembro solicite a otro que ejecute una de sus tareas asignadas. Aplica a tareas diarias, semanales o mensuales.

### Flujo completo

```
Miembro A ve una tarea asignada que no puede o quiere hacer
    → Toca "Solicitar intercambio"
    → Elige al miembro B
    → Elige la tarea de B que tomará a cambio (o solo cede sin recibir)
    → Miembro B recibe notificación:
        "Ana quiere intercambiar 'Limpiar baño' por tu 'Pasar la aspiradora' este mes. ¿Aceptás?"
    → B acepta o rechaza
        → Si acepta:
            → task_assignments se actualiza con los nuevos asignados
            → Ambos reciben notificación de confirmación
            → El ejecutor real marca la tarea como hecha
        → Si rechaza:
            → Notificación a A: "Pedro no pudo aceptar el intercambio"
            → Las asignaciones quedan igual
```

### Tipos de intercambio

| Tipo | Alcance |
|---|---|
| **Diario** | Solo esa ocurrencia del día (`task_execution` específica) |
| **Semanal** | Solo esa ocurrencia de la semana |
| **Mensual** | Toda la asignación del mes (`task_assignment` completa) |

### Reglas del intercambio

- Solo se puede solicitar intercambio de **tareas propias** — no se pueden reclamar tareas de otros sin su consentimiento
- El intercambio **no afecta la rotación base** del mes siguiente — las asignaciones futuras siguen el círculo original
- Si el intercambio es mensual, el mes siguiente la rotación continúa como si el intercambio no hubiera ocurrido (para no distorsionar el círculo a largo plazo)
- Todos los intercambios quedan registrados en el historial y son visibles para el administrador

### Registro en base de datos

Se agrega la tabla `task_swaps`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `requester_id` | UUID FK → users | Quien solicita |
| `target_id` | UUID FK → users | Quien recibe la solicitud |
| `requester_execution_id` | UUID FK → task_executions NULL | Tarea que cede el solicitante |
| `target_execution_id` | UUID FK → task_executions | Tarea que cede el receptor |
| `scope` | ENUM(daily, weekly, monthly) | |
| `status` | ENUM(pending, accepted, rejected, cancelled) | |
| `requested_at` | TIMESTAMP | |
| `resolved_at` | TIMESTAMP NULL | |

---

## Resumen de Reglas del Círculo

| Evento | Efecto en la rotación |
|---|---|
| Fin de mes | El círculo avanza un paso |
| Tarea sobrante | La carga extra alterna mensualmente entre miembros |
| Nueva tarea (rotación actual) | Admin define primer asignado → notificación → desde el mes siguiente entra al círculo |
| Nueva tarea (siguiente rotación) | Se incorpora al círculo el mes siguiente normalmente |
| Nuevo miembro | Entra al círculo el mes siguiente. Puede hacer intercambios durante el mes de ingreso |
| Tarea eliminada | Se excluye del círculo desde el mes siguiente |
| Hogar de 1 miembro | Recibe todo, sin rotación |
| Intercambio aceptado | Se modifica la asignación puntual. El círculo base no se altera |

---

## Pendientes

- [ ] Definir si el intercambio mensual puede hacerse hasta el día 15 (fecha de publicación) o en cualquier momento del mes
- [ ] Definir si el administrador puede forzar un intercambio sin consentimiento de los miembros (no recomendado para el MVP)
- [ ] Implementar el algoritmo de sliding window con manejo de tarea sobrante
- [ ] Implementar tabla `task_swaps` y flujo de notificaciones asociado
