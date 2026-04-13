# Dashboard
## App de Distribución de Tareas del Hogar

> Documento de producto y desarrollo.
> Última actualización: 21-03-2026

---

## Principio General

El dashboard tiene **4 vistas** organizadas en dos ejes:
- **Alcance:** Individual (mis tareas) o Grupal (el hogar)
- **Tiempo:** Diario (hoy) o Mensual (el mes completo)

| | Diaria | Mensual |
|---|---|---|
| **Individual** | Mis tareas de hoy | Mi mes completo |
| **Grupal** | Estado del hogar hoy | Resumen del hogar este mes |

---

## Navegación

Bottom tab bar con una tab por vista — sin menús anidados:

```
[ Hoy ]   [ Mi mes ]   [ Hogar hoy ]   [ Hogar mes ]
```

---

## Vista 1 — Individual Diaria ("Hoy")

**Vista por defecto al abrir la app.**

Muestra las tareas propias del día con su estado y hora de ejecución.

```
┌─────────────────────────────────┐
│  Hola Ana 👋  Sábado 21 marzo   │
│                                 │
│  Tenés 3 tareas hoy             │
│                                 │
│  ✓ Hacer el almuerzo   13:00    │
│  ○ Lavar la ropa       15:00    │
│  ○ Pasar aspiradora    18:00    │
│                                 │
│  [Solicitar intercambio]        │
└─────────────────────────────────┘
```

**Elementos:**
- Saludo con nombre del usuario y fecha
- Contador de tareas del día
- Lista de tareas con: estado (completada / pendiente / missed), nombre y hora
- Botón "Solicitar intercambio" para ceder o intercambiar una tarea del día

**Al tocar una tarea pendiente:**
- Plan free → abre pantalla de detalle con anuncio → botón "Marcar como hecha"
- Plan pago → acción directa también disponible desde la notificación push

---

## Vista 2 — Individual Mensual ("Mi mes")

Progreso personal del mes con historial de cada ejecución.

```
┌─────────────────────────────────┐
│  Ana — Marzo 2026    12 / 18    │
│  ██████████░░░░░░    67%        │
│                                 │
│  ✓ Lavar la ropa     Lun 3      │
│  ✓ Limpiar baño      Mié 5      │
│  ✗ Pasar aspiradora  Vie 7      │
│  ○ Lavar loza        Dom 22     │
│  ...                            │
│                                 │
│  < Feb 2026          Abr 2026 > │
└─────────────────────────────────┘
```

**Elementos:**
- Barra de progreso: completadas / total del mes
- Lista cronológica de todas las ejecuciones del mes: ✓ completada, ✗ missed, ○ pendiente
- Navegación entre meses (flechas)

**Acceso al historial:**
- Plan free → solo el mes actual (flechas deshabilitadas)
- Planes pagos → historial completo de todos los meses

---

## Vista 3 — Grupal Diaria ("Hogar hoy")

Estado de todos los miembros en el día actual.

```
┌─────────────────────────────────┐
│  Casa Martínez — Hoy            │
│                                 │
│  Ana        2/3  ████████░░     │
│  Pedro      1/2  █████░░░░░     │
│  María      0/2  ░░░░░░░░░░  ⚠ │
│                                 │
│  Total      3/7   43%           │
└─────────────────────────────────┘
```

**Elementos:**
- Una fila por miembro con: nombre, progreso (completadas/asignadas hoy) y barra visual
- Indicador de alerta ⚠ si un miembro tiene 0 tareas completadas pasada la mitad del día
- Total del hogar en el día

**Al tocar el nombre de un miembro:**
- Se despliega el detalle de sus tareas del día (visibles para todos)

---

## Vista 4 — Grupal Mensual ("Hogar mes")

Gráfico comparativo de todos los miembros en el mes.

```
┌─────────────────────────────────┐
│  Casa Martínez — Marzo 2026     │
│  Progreso general: 67%          │
│                                 │
│  10 │ ██ ░░                     │
│   8 │ ██ ░░ ██ ░░               │
│   6 │ ██ ██ ██ ░░ ░░            │
│     └──────────────────         │
│       Ana   Pedro  María        │
│      ██ Completadas ░░ Asignadas│
│                                 │
│  < Feb 2026          Abr 2026 > │
└─────────────────────────────────┘
```

**Elementos:**
- Porcentaje de progreso general del hogar en el mes
- Gráfico de barras agrupadas por miembro:
  - Barra gris: tareas asignadas (techo fijo del mes)
  - Barra de color: tareas completadas (crece durante el mes)
- Navegación entre meses (flechas)

**Al tocar el nombre de un miembro en el gráfico:**
- Se navega a la Vista 2 (Individual Mensual) de ese miembro

**Acceso al historial:**
- Plan free → solo el mes actual
- Planes pagos → historial completo

---

## Acceso por Plan

| Vista | Free | Hogar / Familia |
|---|---|---|
| Individual Diaria | ✓ | ✓ |
| Individual Mensual | Solo mes actual | Historial completo |
| Grupal Diaria | ✓ | ✓ |
| Grupal Mensual | Solo mes actual | Historial completo |

El historial de meses anteriores es un argumento de conversión natural a planes pagos.

---

## Transparencia y Control Social

- El detalle de tareas de cualquier miembro es visible para **todos** los integrantes del hogar.
- No hay información privada en el dashboard — solo tareas del hogar compartidas.
- Esta visibilidad es el mecanismo principal de accountability sin necesidad de verificación técnica.

---

## Datos que Alimentan el Dashboard

| Vista | Fuente de datos |
|---|---|
| Individual Diaria | `task_executions` del día filtradas por `assigned_to = usuario_actual` |
| Individual Mensual | `task_executions` del mes filtradas por `assigned_to` |
| Grupal Diaria | `task_executions` del día agrupadas por `assigned_to` |
| Grupal Mensual | `task_executions` del mes agrupadas por `assigned_to` + `monthly_reports` |

Supabase Realtime actualiza las vistas diarias en tiempo real cuando cualquier miembro marca una tarea.

---

## Pendientes

- [ ] Definir paleta de colores por miembro (para diferenciarlos en el gráfico grupal)
- [ ] Definir el umbral exacto del indicador de alerta ⚠ en la vista grupal diaria (ej: después de las 17:00 con 0 completadas)
- [ ] Definir si el administrador tiene una vista extra de configuración accesible desde el dashboard
- [~] Nombre tentativo de la app: **MeToca** — tagline: *"Hogar Ordenado"*
- [ ] Diseñar las pantallas
