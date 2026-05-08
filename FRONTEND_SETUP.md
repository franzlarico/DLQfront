# Frontend - Changes & Setup Guide

## 🎨 Cambios Realizados en el Frontend

### 1. ✅ Actualización de Types (src/types.ts)
- **Antes:** DashboardWindow tenía valores `'today' | '24h' | '7d'`
- **Ahora:** Valores correctos `'24h' | '7d' | '30d' | 'all'`
- Nuevos tipos de respuesta para auditoría:
  - `ActivityItem` mejorado con campos de auditoría
  - `QueueDistributionItem` con estadísticas reales
  - `ExceptionSummaryItem` simplificado

### 2. ✅ Mejoras en Inspector.vue
- ✅ Agregada columna "Hora llegada DLQ" en metadata
- ✅ Agregada columna "Inspeccionado" con timestamp
- ✅ Mayor visibilidad del cuándo pasó cada cosa

Nuevas filas en metadata-grid:
```vue
<span>Hora llegada DLQ</span>
<strong>{{ selectedMessage.metadata?.dlq?.latestTime ? shortDate(selectedMessage.metadata.dlq.latestTime) : '-' }}</strong>

<span>Inspeccionado</span>
<strong>{{ selectedMessage.inspectedAt ? shortDate(selectedMessage.inspectedAt) : '-' }}</strong>
```

### 3. ✅ Dashboard.vue Completamente Actualizado
- ✅ Endpoints actualizados para nuevas rutas
- ✅ Tipos de datos sincronizados con backend
- ✅ Status cards con información correcta:
  - Mensajes en DLQ
  - Reencolados exitosos  
  - Tamaño promedio
  - Colas activas

#### Cambios en las Cards:

**Antes:**
```
- Dead Letters: 100
- Recuperacion: 85%
- Reencolados Hoy: 50
- Tiempo promedio: 2.5min
```

**Ahora:**
```
- Mensajes en DLQ: 100 (total real)
- Reencolados: 50 (exitosos)
- Tamaño promedio: 2.3KB
- Colas Activas: 5
```

#### Gráficos Actualizados:

**Distribución de Colas:**
- Mostra `totalMessages` en lugar de `currentMessages`
- Muestra `requeuedMessages` en lugar de `sharePercent`
- Muestra `failedOperations` en lugar de `peakMessages`

**Razones de Dead Letters:**
- Ahora calcula porcentajes dinámicamente
- Muestra solo la razón (sin queue, ni latestSeenAt)

**Actividad Reciente:**
- Muestra `eventType` (REQUEUE, INSPECT, ERROR)
- Muestra cola source
- Muestra exchange y routing key destino
- Muestra contador de éxito: `successCount/messageCount`
- Muestra duración de operación

### 4. ✅ API Methods Nuevos
Métodos que funcionan con el backend nuevo:

```typescript
// Estos ya existían y siguen funcionando igual
rabbitApi.getConfig()
rabbitApi.listQueues()
rabbitApi.getMessages(queue, limit)
rabbitApi.requeue(queue, payload)

// Estos ahora funcionan correctamente:
rabbitApi.getDashboardSummary(window)
rabbitApi.getDashboardQueues(window)
rabbitApi.getDashboardExceptions(window)
rabbitApi.getDashboardActivity(window, limit)
rabbitApi.getHealth()
```

---

## 🚀 Setup Frontend

### 1. Instalar Dependencias
```bash
cd D:/Usuarios/flarico/Desktop/DLQfront
npm install
```

### 2. Configurar Variable de Entorno
```bash
# Crear archivo .env.local
echo "VITE_API_BASE_URL=http://localhost:3001" > .env.local
```

Si el backend está en otro puerto:
```bash
echo "VITE_API_BASE_URL=http://localhost:3000" > .env.local
```

### 3. Iniciar Servidor de Desarrollo
```bash
npm run dev
```

Acceder en: `http://localhost:5173`

### 4. Build para Producción
```bash
npm run build
```

Output en: `dist/`

---

## 📱 Nuevas Funcionalidades en el Dashboard

### Tabla de Resumen
Muestra 4 cards principales:
1. **Estado del Sistema** - Saludable/Atencion
   - Status de DB, AMQP, Management

2. **Mensajes en DLQ** - Total de mensajes
   - Informa cuántos fueron reencolados

3. **Reencolados** - Total de mensajes exitosos
   - Muestra tamaño promedio

4. **Colas Activas** - Cantidad de colas únicas
   - Ventana temporal seleccionada

### Gráfico de Distribución
Bar chart por cola mostrando:
- Total de mensajes en esa cola
- Cantidad reencolada
- Cantidad de fallos

### Razones de DLQ
Top 10 razones de muerte con conteo y %

### Actividad Reciente
Feed de últimos 20 eventos con:
- Hora exacta
- Tipo de evento
- Cola afectada
- Contador de proceso
- Estado final

---

## 🔌 Validación de Conectividad

### Antes de usar el Dashboard:

1. **Verificar backend corriendo:**
```bash
curl http://localhost:3001/rabbit/config
```

Debe retornar configuración (no error)

2. **Verificar MongoDB conectado:**
```bash
curl http://localhost:3001/health
```

Debe mostrar `dependencies.database: up`

3. **Verificar RabbitMQ:**
```bash
curl http://localhost:3001/rabbit/queues
```

Debe retornar lista de colas (puede estar vacía)

---

## 🎯 Pantalla de Inspector

### Secciones Principales

1. **Controls (Arriba)**
   - Cola activa
   - Límite de inspección
   - Auto-refresh toggle
   - Botón Inspeccionar

2. **Colas Detectadas**
   - Cartas con colas DLQ disponibles
   - Contador de mensajes
   - Click para seleccionar

3. **Workspace (Centro)**
   - Panel izquierdo: Lista de mensajes
   - Panel central: Detalles del mensaje
   - Panel derecho: Controles de requeue

4. **Detalles del Mensaje**
   - Body
   - DLQ Metadata (con nueva "Hora llegada DLQ")
   - Headers
   - Properties
   - Raw JSON

5. **Panel de Requeue**
   - Cantidad a reencolador
   - Exchange destino (auto-inferido)
   - Routing key destino (auto-inferida)
   - Botón Reencolar (rojo/danger)

---

## 🔄 Flujo Completo

### 1. Inspector
```
1. Se carga la lista de colas DLQ
2. Usuario selecciona una cola
3. Se cargan los mensajes
4. Usuario selecciona un mensaje
5. Se muestran detalles (incluyendo hora llegada)
```

### 2. Requeue
```
1. Usuario completa formulario
2. Click en "Reencolar"
3. Backend publica a exchange/routing-key
4. Backend guarda en audit log
5. Frontend muestra éxito
6. Dashboard se actualiza automáticamente (si auto-refresh)
```

### 3. Dashboard
```
1. Carga datos de últimas 24h
2. Muestra estadísticas
3. Auto-refresh cada 30s
4. Usuario puede cambiar ventana (24h/7d/30d)
```

---

## 🐛 Debugging en Frontend

### Logs en Consola del Navegador

1. **F12** → Console
2. Búsqueda: `rabbitApi`

### Requests HTTP

1. **F12** → Network
2. Ver todas las llamadas a `/dashboard/*`
3. Verificar status 200 y payload

### Problemas Comunes

#### "No se pudo conectar con el backend"
- ✅ Verificar que backend está corriendo en puerto 3001
- ✅ Verificar VITE_API_BASE_URL correcto
- ✅ Verificar CORS habilitado en backend

#### "No se pudo cargar la observabilidad"
- ✅ Verificar MongoDB está conectado
- ✅ Ver `/health` endpoint
- ✅ Revisar logs del backend

#### "Dashboard muestra datos vacíos"
- ✅ No hay operaciones en la ventana de tiempo seleccionada
- ✅ Cambiar a "30d" para ver si hay histórico
- ✅ Hacer un requeue de prueba

---

## 📊 Estructura del Estado (Vue)

```typescript
// Dashboard.vue State
dashboardWindow: '24h' | '7d' | '30d' | 'all'
health: HealthResponse | null
summary: DashboardSummary | null
queueDistribution: QueueDistributionItem[]
exceptionSummary: ExceptionSummaryItem[]
activityItems: ActivityItem[]

// Inspector.vue State
queueName: string
queues: QueueListItem[]
messages: InspectedMessage[]
activeMessageId: string | null
requeueing: boolean
loading: boolean
```

---

## 🚨 Manejo de Errores

### En Inspector
```typescript
// Si falla inspección
error.value = "Error message"
// Se limpia después de exitoso requeue
```

### En Dashboard
```typescript
// Si falla carga
dashboardError.value = "Error message"
// Se muestra en rojo en la parte superior
```

---

## 📝 Notas de Cambios Importantes

1. **DashboardWindow**: Cambió el tipo, ahora incluye '30d' y 'all'
2. **ActivityItem**: Completamente rediseñado para mostrar auditoría
3. **QueueDistributionItem**: Cambió de picos/trends a estadísticas reales
4. **ExceptionSummaryItem**: Simplificado, solo reason y count

---

## ✅ Checklist de Validación

- [ ] npm install ejecutado
- [ ] .env.local creado con VITE_API_BASE_URL correcta
- [ ] npm run dev ejecutado sin errores
- [ ] Frontend carga en localhost:5173
- [ ] Inspector carga lista de colas
- [ ] Dashboard muestra cards de estado
- [ ] Pueden hacer click en una cola
- [ ] Pueden ver detalles de mensajes
- [ ] Hora llegada DLQ visible en detalles
- [ ] Pueden hacer requeue
- [ ] Dashboard muestra nueva actividad

---

**Frontend actualizado y listo para usar.** 🎉
