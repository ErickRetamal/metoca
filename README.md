# MeToca — Hogar Ordenado

App móvil para la distribución automática de tareas del hogar. Diseñada para familias, parejas y roommates latinoamericanos.

---

## Stack

| Capa | Tecnología |
|---|---|
| App móvil | React Native + Expo |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Notificaciones | Firebase Cloud Messaging (FCM) + APNS |
| Suscripciones | RevenueCat |
| Gestión de proyecto | GitHub + Linear |

---

## Estructura del proyecto

```
metoca/
├── app/                        # Expo Router — rutas de la app
│   ├── (auth)/                 # Flujo de onboarding y autenticación
│   │   ├── welcome.tsx
│   │   ├── value-prop.tsx
│   │   ├── how-it-works.tsx
│   │   ├── register.tsx
│   │   ├── login.tsx
│   │   ├── push-permission.tsx
│   │   └── paywall.tsx
│   └── (app)/
│       └── (tabs)/             # Navegación principal (bottom tab bar)
│           ├── today.tsx           # Hoy (Mi día / Hogar) — Vista unificada
│           └── my-month.tsx        # Mes (Usuario / Hogar) — Vista unificada
│
├── components/                 # Componentes reutilizables
│   ├── ui/                     # Componentes base (botones, inputs, cards)
│   ├── dashboard/              # Gráficos y widgets del dashboard
│   ├── tasks/                  # Componentes de tareas
│   ├── household/              # Componentes de hogar y miembros
│   └── notifications/          # Banner de push desactivado, etc.
│
├── lib/                        # Clientes y lógica de servicios externos
│   ├── supabase/               # Cliente de Supabase + helpers
│   ├── notifications/          # Registro y gestión de push tokens
│   ├── purchases/              # RevenueCat — suscripciones
│   └── sync/                   # Cola offline para marcar tareas sin conexión
│
├── hooks/                      # Custom hooks de React
├── stores/                     # Estado global (Zustand o Context)
├── types/                      # Tipos TypeScript (refleja el modelo de datos)
├── constants/                  # Tema, colores, spacing
│
└── supabase/                   # Configuración de Supabase
    ├── migrations/             # Migraciones SQL
    │   └── 001_initial_schema.sql
    └── functions/              # Edge Functions (Deno)
        ├── dispatch-notifications/
        ├── generate-assignments/
        ├── generate-monthly-report/
        └── validate-receipt/
```

---

## Primeros pasos

### 1. Clonar y configurar variables de entorno

```bash
cp .env.example .env
# Completar con las credenciales de Supabase y RevenueCat
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar `supabase/migrations/001_initial_schema.sql` en el SQL Editor
3. Copiar la URL y anon key al `.env`

### 4. Configurar Firebase

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Agregar app Android y app iOS
3. Descargar `google-services.json` (Android) y `GoogleService-Info.plist` (iOS)
4. Colocar los archivos en la raíz del proyecto (están en `.gitignore`)

### 5. Configurar RevenueCat

1. Crear cuenta en [RevenueCat](https://revenuecat.com)
2. Crear proyecto y vincular con App Store Connect y Google Play Console
3. Copiar las API keys al `.env`

### 6. Correr la app

```bash
npx expo start
```

---

## Documentación del proyecto

La documentación completa se encuentra en `../Tareas_Diarias/`:

- `Reglas de Negocio - App Tareas del Hogar.md`
- `Modelo de Datos y Consideraciones Técnicas.md`
- `Stack Técnico.md`
- `Flujo de Onboarding.md`
- `Flujo de Notificaciones Push.md`
- `Algoritmo de Rotación de Tareas.md`
- `Dashboard.md`
