# Rabbit DLQ Console - Frontend

Frontend Vue 3 + Vite + TypeScript para administrar y observar colas DLQ de RabbitMQ.

## Descripción

Aplicación web de consola con dos vistas principales:
- **Inspector**: inspección de mensajes DLQ, vista de metadatos y requeue.
- **Observabilidad**: dashboard de salud, estado de colas, razones de DLQ y actividad reciente.

El frontend consume un backend compatible con rutas como `/rabbit`, `/dashboard`, `/requeue` y `/nacos`.

## Requisitos

- Node.js 18+
- npm
- Backend compatible en ejecución

## Instalación

```bash
npm install
```

## Configuración

El frontend utiliza la variable de entorno `VITE_API_BASE_URL` para apuntar al backend.

Crea un archivo `.env` o `.env.local` en la raíz del proyecto:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Si no se define, el frontend usa por defecto `http://localhost:3000`.

## Scripts disponibles

```bash
npm run dev      # Inicia Vite en modo desarrollo
npm run build    # Construye la app para producción
npm run preview  # Sirve la build de producción localmente
```

## Estructura principal del proyecto

- `src/App.vue` — navegación entre Inspector y Dashboard
- `src/views/Inspector.vue` — vista de inspección de DLQ
- `src/views/Dashboard.vue` — dashboard de observabilidad
- `src/services/rabbit.service.ts` — cliente HTTP hacia el backend
- `src/api/rabbit.ts` — reexporta `rabbitService` como `rabbitApi`
- `src/types/` — tipos TypeScript compartidos
- `src/components/` — componentes reutilizables
- `src/composables/` — hooks y lógica reactiva compartida

## Funcionalidades principales

- Lista y filtrado de colas DLQ
- Inspección de mensajes con metadata detallada
- Requeue de mensajes desde DLQ
- Dashboard con salud del sistema y métricas de colas
- Exportación de dashboard desde el backend (`json`/`csv`)
- Recarga de configuración Nacos mediante backend

## Backend compatible esperado

El frontend usa las siguientes rutas principales:

- `GET /rabbit/config`
- `GET /rabbit/queues`
- `GET /rabbit/queues/:queue`
- `GET /rabbit/queues/:queue/messages?limit=...`
- `POST /rabbit/queues/:queue/requeue`
- `POST /requeue/jobs`
- `GET /requeue/jobs/:id`
- `GET /dashboard/summary?window=...`
- `GET /dashboard/queues?window=...`
- `GET /dashboard/exceptions?window=...`
- `GET /dashboard/activity?window=...&limit=...`
- `GET /dashboard/health` o `GET /health`
- `POST /nacos/reload`
- `GET /nacos/status`
- `GET /dashboard/export?window=...&format=...`

## Ejecución

```bash
npm run dev
```

Abre el navegador en `http://localhost:5173`.

## Notas

- El proyecto actual no usa router de Vue; la vista se cambia directamente desde `App.vue`.
- El valor por defecto de backend es `http://localhost:3000`, no `3001`.
- Si el backend no responde, el frontend mostrará errores de conexión en las vistas.
