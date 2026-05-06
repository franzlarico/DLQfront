# Rabbit DLQ Console - Frontend

Frontend Vue para operar y observar DLQ de RabbitMQ.

## Lo nuevo en esta version

- Dashboard operativo con KPIs
- Distribucion por cola
- Top excepciones
- Actividad reciente auditada
- Export de logs
- Requeue masivo de colas activas
- Vista operativa detallada por mensaje

## Requisitos

- Node.js 18+
- Backend corriendo en `http://localhost:3001`

## Instalacion

```bash
npm install
npm run dev
```

## Configuracion

`.env`

```env
VITE_API_BASE_URL=http://localhost:3001
```

## Flujos principales

1. El dashboard consulta KPIs y estado del sistema.
2. La consola detecta solo colas DLQ con mensajes.
3. Al inspeccionar, el backend lee mensajes sin consumirlos definitivamente.
4. Al reencolar, el frontend crea un job auditado en el backend.
5. El dashboard se actualiza con historico, recovery rate y actividad reciente.

## Build

```bash
npm run build
```
