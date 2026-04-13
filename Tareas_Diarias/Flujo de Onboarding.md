# Flujo de Onboarding
## App de Distribución de Tareas del Hogar

> Documento de producto y desarrollo.
> Última actualización: 21-03-2026

---

## Principio General

El onboarding termina obligatoriamente en un **paywall**. El usuario no puede acceder a la app sin pasar por él y elegir un plan (incluyendo el gratuito).

El plan gratuito **requiere cuenta** (email + contraseña). Sin cuenta no hay acceso, sin importar el plan elegido.

---

## Flujo Completo

```
Pantalla 1 — Bienvenida
        ↓
Pantalla 2 — Propuesta de valor
        ↓
Pantalla 3 — Cómo funciona
        ↓
Pantalla 4 — Registro (email + contraseña)
        ↓
Pantalla 5 — Permiso de notificaciones push
        ↓
Pantalla 6 — Paywall
        ↓
        App
```

---

## Detalle de Cada Pantalla

### Pantalla 1 — Bienvenida
- Logo y nombre de la app
- Tagline corto (definir con el naming de la app)
- Botón: "Comenzar"

---

### Pantalla 2 — Propuesta de valor
Mostrar el problema que resuelve, no las features. Ejemplo de contenido:

> *"¿Siempre te toca a ti acordarte de todo en casa?"*
> Las tareas del hogar no fallan por flojera — fallan porque a nadie se le ocurre hacerlas.
> Esta app se encarga de que eso no vuelva a pasar.

- Diseño visual simple, una idea por pantalla
- Puede ser un carrusel de 2-3 slides si se quiere profundizar

---

### Pantalla 3 — Cómo funciona
3 pasos simples, con ícono cada uno:

1. **Crea tu hogar** — agrega a quienes viven contigo
2. **Define las tareas** — qué hay que hacer y con qué frecuencia
3. **Listo** — cada uno recibe sus tareas con recordatorio en el momento exacto

---

### Pantalla 4 — Registro
- Campo: Email
- Campo: Contraseña
- Botón: "Crear cuenta"
- Link secundario: "¿Ya tenés cuenta? Inicia sesión"
- Link terciario pequeño: "Política de privacidad" (obligatorio para tiendas)

**¿Por qué el registro va ANTES del paywall?**
Si el usuario cierra la app en el paywall, ya tenemos su email para retargeting por correo. Si el registro fuera después, ese usuario se iría sin dejar nada.

**Nota técnica:** el registro usa Supabase Auth. Al crear la cuenta se genera automáticamente un registro en `subscriptions` con `plan = free` como estado inicial.

---

### Pantalla 5 — Permiso de notificaciones push
Antes de que el sistema operativo muestre el diálogo nativo del permiso, mostrar una pantalla propia que explique el por qué:

> *"Para que funcione, necesitamos enviarte recordatorios"*
> Sin notificaciones, la app pierde su función principal.
> Solo te avisaremos cuando tengás una tarea pendiente — nada más.

- Botón principal: "Activar recordatorios"
- Botón secundario pequeño: "Ahora no" (no se puede bloquear este paso)

**Al tocar "Activar recordatorios"** → se dispara el diálogo nativo del SO para pedir el permiso real.

**¿Por qué va antes del paywall?**
El paywall vende la promesa de los recordatorios. Si el usuario ya los aceptó, esa promesa tiene más peso. Además aumenta la tasa de aceptación del permiso porque el usuario ya entendió el valor antes de que se lo pidamos.

---

### Pantalla 6 — Paywall
**Título:** orientado al beneficio, no al producto.
Ejemplo: *"El hogar organizado parte hoy"*

**Contenido obligatorio (reglas de App Store y Google Play):**
- Los 3 planes visibles con precios en CLP y período (mensual)
- Plan recomendado visualmente destacado (ej: "Hogar")
- Indicar claramente que se renueva automáticamente
- Indicar condiciones del período de prueba si se ofrece
- Botón para continuar con plan gratis visible (no oculto ni engañoso)
- Link a política de privacidad y términos de uso

**Estructura visual sugerida de los planes:**

| | Gratis | Hogar ⭐ | Familia |
|---|---|---|---|
| Miembros | 2 | 5 | 10 |
| Precio | $0 | $2.990/mes | $4.990/mes |

**Botones:**
- "Comenzar con Hogar" (acción principal)
- "Continuar gratis" (acción secundaria, visible pero secundaria)

---

## Reglas de Tiendas que Aplican al Paywall

| Regla | Consecuencia si se viola |
|---|---|
| El usuario DEBE poder acceder al plan gratuito sin pagar | Rechazo de la app |
| No se puede bloquear el acceso total sin alternativa gratuita | Rechazo |
| Precio exacto y frecuencia deben mostrarse antes de confirmar | Rechazo |
| Debe indicarse que la suscripción se renueva automáticamente | Rechazo |
| No se pueden usar dark patterns (botón gratis invisible o confuso) | Rechazo + posible baja |
| Período de prueba debe comunicarse claramente | Rechazo |

---

## Por qué el Plan Free Requiere Cuenta

1. **Control de abuso:** sin cuenta, un usuario puede desinstalar y reinstalar la app infinitas veces para tener siempre acceso "nuevo". Con email vinculado, el plan free es uno por persona real.

2. **Email como activo de negocio:** es la base del ciclo de vida del usuario.

3. **El reporte mensual ya requiere email** — no es un dato adicional invasivo, es necesario para la función principal.

---

## Ciclo de Emails Automatizados (usuarios free)

| Email | Trigger | Objetivo |
|---|---|---|
| Bienvenida | Registro completado | Explicar valor, primeros pasos |
| Activación | Sin crear hogar a las 48 horas | Reducir abandono temprano |
| Recordatorio de reporte | Día 25 de cada mes | Retención, mostrar valor |
| Upgrade natural | Hogar llega al límite de miembros | Conversión orgánica |
| Conversión por inactividad | 30 días en free sin convertir | Oferta o prueba extendida |

---

## Pendientes

- [~] Nombre tentativo: **MeToca** — tagline: *"Hogar Ordenado"* (pendiente confirmar definitivamente)
- [ ] Definir si se ofrece período de prueba gratuito en los planes pagos y su duración
- [ ] Redactar contenido final de cada pantalla
- [ ] Diseñar las pantallas
- [ ] Configurar los emails automatizados (servicio de email por definir)
- [ ] Redactar política de privacidad y términos de uso (requisito de tiendas)
