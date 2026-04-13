# Stack Técnico
## App de Distribución de Tareas del Hogar

> Documento técnico para el equipo de desarrollo.
> Última actualización: 21-03-2026

---

## Decisión de Plataforma

**Una sola app para iOS y Android** (no dos apps nativas separadas).

**Razones:**
- El equipo es de 2 personas — mantener dos codebases nativas duplica el trabajo, los bugs y las pruebas.
- La app no requiere capacidades nativas profundas (sin cámara, GPS, Bluetooth, ARKit ni hardware específico). Todo es formularios, listas, notificaciones y pagos — perfectamente cubierto por React Native.
- Chile tiene aproximadamente 60% Android / 40% iOS. Lanzar en un solo sistema operativo elimina casi la mitad del mercado beta desde el día 1.
- La decisión de ir nativo por plataforma aplica solo si en versiones futuras se requieren widgets de pantalla de inicio complejos, integración profunda con asistentes de voz (Siri, Google Assistant) o rendimiento gráfico extremo. Ninguno aplica al MVP.

---

## Stack Seleccionado

### Móvil — React Native + Expo

| Herramienta | Uso |
|---|---|
| React Native | Framework principal de la app |
| Expo SDK | Simplifica configuración de iOS y Android |
| EAS Build | Compilación y distribución en ambas tiendas desde un solo pipeline |
| Expo Updates (OTA) | Publicar correcciones de JavaScript sin pasar por revisión de tienda |
| expo-notifications | Integración con FCM (Android) y APNS (iOS) |
| react-native-purchases | SDK de RevenueCat para suscripciones |

**¿Por qué Expo?**
- Gestiona automáticamente los certificados, provisioning profiles y configuración nativa de iOS que de otra forma consumirían días.
- EAS Build permite compilar para ambas plataformas desde CI/CD sin necesidad de una Mac dedicada para los builds de iOS.

---

### Backend — Supabase

| Componente | Uso |
|---|---|
| PostgreSQL | Base de datos principal (modelo de datos definido en doc separado) |
| Supabase Auth | Autenticación (login, tokens JWT, refresh) — completamente resuelto |
| Supabase Realtime | Dashboard en vivo del hogar sin construir websockets |
| Edge Functions | Lógica personalizada: validar recibos de Apple/Google, enviar push, etc. |
| pg_cron | Jobs programados dentro de la base de datos |

**Jobs programados en Supabase (no en el dispositivo):**
- **Día 15 de cada mes:** genera las asignaciones del mes siguiente en `task_assignments`
- **Día 1 de cada mes:** agrega ejecuciones del mes anterior y genera `monthly_reports`
- **Diario:** crea los registros de `task_executions` del día siguiente y encola las notificaciones

Toda la lógica crítica corre en el servidor. El dispositivo solo recibe la notificación push resultante. Esto elimina las diferencias de comportamiento entre iOS y Android para esa lógica.

---

### Notificaciones Push — Firebase Cloud Messaging (FCM)

| Aspecto | Detalle |
|---|---|
| Proveedor | Firebase Cloud Messaging (Google) |
| Android | FCM entrega directamente |
| iOS | FCM actúa como bridge hacia APNS (Apple Push Notification Service) |
| Integración en app | `expo-notifications` |
| Costo | Gratuito |

**Consideraciones por plataforma:**

| Aspecto | iOS | Android |
|---|---|---|
| Permiso explícito del usuario | Sí — obligatorio, diálogo al primer uso | Android 13+: también obligatorio. Android 12 y abajo: automático |
| Acciones desde la notificación (marcar como hecha) | Soportado via Notification Actions, con restricciones de background | Más flexible |
| Comportamiento en background | iOS mata procesos agresivamente | Más permisivo, pero varía por fabricante (Xiaomi, Samsung) |

**Estrategia de onboarding:** solicitar permiso de notificaciones en el momento correcto del flujo, con contexto claro de por qué se necesita. Si el usuario rechaza, la app pierde su función principal. El onboarding debe hacer visible este punto antes de pedir el permiso.

---

### Suscripciones — RevenueCat

| Aspecto | Detalle |
|---|---|
| Propósito | Abstrae StoreKit 2 (iOS) y Play Billing (Android) en una sola API |
| Validación de recibos | RevenueCat valida contra Apple y Google automáticamente |
| Manejo de ciclo de vida | Renovaciones, cancelaciones, períodos de gracia, reembolsos |
| Sandbox para pruebas | Entorno de prueba unificado para ambas plataformas |
| Costo | Gratuito hasta USD 2.500 de ingresos mensuales |

**Sin RevenueCat** habría que mantener dos flujos de validación completamente distintos:
- iOS: validar JWS contra la API de Apple (StoreKit 2)
- Android: validar contra `purchases.subscriptions.get` de Google Play Developer API

RevenueCat elimina esa duplicidad y es el estándar de la industria para apps indie y startups.

**Configuración requerida (por plataforma, una sola vez):**

| Plataforma | Dónde se configura el producto de suscripción |
|---|---|
| iOS | App Store Connect → In-App Purchases |
| Android | Google Play Console → Productos de suscripción |

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                   App Móvil                         │
│           React Native + Expo                       │
│                                                     │
│  expo-notifications   │   react-native-purchases    │
│  (FCM + APNS)         │   (RevenueCat SDK)          │
└──────────────┬────────────────────┬─────────────────┘
               │                    │
               ▼                    ▼
        Firebase FCM           RevenueCat
        (entrega push)      (valida Apple/Google)
               │                    │
               └─────────┬──────────┘
                          ▼
                      Supabase
               ┌──────────────────────┐
               │  PostgreSQL          │
               │  Auth (JWT)          │
               │  Realtime            │
               │  Edge Functions      │
               │  pg_cron (jobs)      │
               └──────────────────────┘
```

---

## Diferencias iOS vs Android que Impactan Esta App

| Capa | ¿Hay diferencia? | ¿Quién la abstrae? |
|---|---|---|
| UI y lógica de negocio | No | React Native |
| Notificaciones push | Sí — token APNS vs FCM | Expo + FCM como bridge |
| Suscripciones y pagos | Sí — StoreKit 2 vs Play Billing | RevenueCat |
| Jobs programados (día 15, reportes) | Sí — iOS más restrictivo en background | Supabase (corre en servidor) |
| Certificados y builds | Sí — iOS requiere Apple Developer Portal | Expo EAS Build |
| Actualizaciones sin revisión de tienda | Mínima diferencia | Expo Updates (OTA) |

---

## Publicación en Tiendas

### Requisitos previos

| Requisito | Plataforma | Costo |
|---|---|---|
| Apple Developer Program | iOS | USD 99 / año |
| Google Play Developer Account | Android | USD 25 único |
| Política de privacidad pública (URL) | Ambas | — |
| Flujo de eliminación de cuenta en la app | Ambas | — |
| Privacy Nutrition Label completado | iOS | — |

### Tiempos de revisión

| Evento | iOS | Android |
|---|---|---|
| Primera publicación | 1–3 días hábiles | 1–7 días |
| Actualizaciones | 1–3 días hábiles | Horas |
| Hotfix JS (sin cambios nativos) | Sin revisión via Expo OTA | Sin revisión via Expo OTA |

---

## Costos de Infraestructura — Etapa Beta

| Servicio | Plan | Costo |
|---|---|---|
| Expo / EAS Build | Free | $0 |
| Supabase | Free (hasta 50.000 MAU) | $0 |
| Firebase FCM | Spark (gratuito) | $0 |
| RevenueCat | Free (hasta USD 2.500 MRR) | $0 |
| Apple Developer Program | — | USD 99 / año |
| Google Play Developer | — | USD 25 único |
| **Total año 1** | | **~USD 124** |

---

## Gestión del Proyecto

### Control de Versiones — GitHub
- Repositorio principal en GitHub
- Flujo de trabajo: Pull Requests obligatorios antes de mergear a `main` — el código del otro se revisa siempre antes de integrarse
- **GitHub Actions** para CI/CD integrado con EAS Build (compilación automática al hacer merge)

### Gestión de Tareas — Linear
- Linear como herramienta de gestión de issues y backlog
- Integración nativa con GitHub: los issues de Linear se vinculan automáticamente con Pull Requests y commits
- Gratis para equipos pequeños
- Alternativa si el equipo ya conoce JIRA: migración sencilla cuando escale el equipo

### Flujo de trabajo sugerido
```
Linear issue creado
    → rama en GitHub: feature/nombre-del-issue
        → desarrollo
            → Pull Request hacia main
                → revisión del otro integrante
                    → merge
                        → GitHub Actions dispara EAS Build
```

---

## Pendientes Técnicos

- [ ] Crear proyecto en Expo y configurar EAS Build
- [ ] Crear proyecto en Supabase y correr migraciones del modelo de datos
- [ ] Crear proyecto en Firebase y obtener credenciales FCM
- [ ] Crear cuenta en RevenueCat y vincular con App Store Connect y Google Play Console
- [ ] Crear cuenta Apple Developer Program (USD 99)
- [ ] Crear cuenta Google Play Developer (USD 25)
- [ ] Configurar certificado APNS para notificaciones push en iOS
- [ ] Definir flujo de onboarding con solicitud de permisos push
- [ ] Implementar Edge Functions en Supabase para los jobs del día 15 y día 1
- [ ] Implementar validación de recibos via RevenueCat en el backend
