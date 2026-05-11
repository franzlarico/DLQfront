# Arquitectura Modular del Proyecto

## Estructura de Carpetas

```
src/
├── components/
│   ├── sections/                 # Componentes principales del Inspector
│   │   ├── InspectorHeader.vue
│   │   ├── ControlsPanel.vue
│   │   ├── QueuesSection.vue
│   │   ├── MessagesPanel.vue
│   │   ├── DetailPanel.vue
│   │   ├── RequeuePanel.vue
│   │   └── index.ts
│   ├── AlertBox.vue              # Componentes UI reutilizables
│   ├── TabBar.vue
│   ├── CodeViewer.vue
│   ├── MetadataTable.vue
│   ├── CopyButton.vue
│   ├── QueueCard.vue
│   ├── MessageItem.vue
│   └── index.ts
├── composables/                   # Lógica reusable
│   ├── useQueues.ts              # Gestión de colas
│   ├── useMessages.ts            # Gestión de mensajes
│   ├── useClipboard.ts           # Operaciones de portapapeles
│   ├── useAutoRefresh.ts         # Auto-actualización
│   ├── useRequeue.ts             # Operaciones de reencolado
│   └── index.ts
├── services/                      # Capa de comunicación con API
│   ├── rabbit.service.ts         # Servicio RabbitMQ
│   └── index.ts
├── types/                         # Tipos TypeScript
│   ├── rabbit.ts                 # Tipos de RabbitMQ
│   ├── dashboard.ts              # Tipos de Dashboard
│   ├── common.ts                 # Tipos comunes
│   └── index.ts
├── utils/                         # Funciones utilitarias
│   ├── formatters.ts             # Funciones de formato
│   ├── validators.ts             # Validaciones
│   └── index.ts
├── views/
│   ├── Inspector.vue             # Vista principal (refactorizada)
│   └── Dashboard.vue
├── styles/
│   └── (estilos globales)
├── App.vue
└── main.ts
```

## Responsabilidades de Cada Capa

### 📁 `types/`
**Propósito:** Centralizar todas las definiciones de tipos TypeScript

- **rabbit.ts** - Tipos relacionados con RabbitMQ (colas, mensajes, etc.)
- **dashboard.ts** - Tipos del dashboard
- **common.ts** - Tipos comunes del proyecto

**Beneficio:** Fácil mantenimiento, reutilización en toda la app

### 📁 `services/`
**Propósito:** Gestionar la comunicación con el backend

- **rabbit.service.ts** - Todas las llamadas HTTP al API de RabbitMQ

**Beneficio:** Separación clara, cambios fáciles de la API

### 📁 `composables/`
**Propósito:** Lógica reutilizable que no es específica de un componente

- **useQueues** - Gestión de estado y operaciones de colas
- **useMessages** - Gestión de mensajes inspeccionados
- **useClipboard** - Copiar contenido al portapapeles
- **useAutoRefresh** - Control de auto-actualización periódica
- **useRequeue** - Operaciones y estado de reencolado

**Beneficio:** Lógica testeable, reutilizable, separada del UI

### 📁 `utils/`
**Propósito:** Funciones utilitarias simples

- **formatters.ts** - Formateo de datos (JSON, fechas, etc.)
- **validators.ts** - Validaciones de entrada

**Beneficio:** Funciones puras, fáciles de testear

### 📁 `components/`
**Propósito:** Componentes Vue reutilizables

#### `sections/` - Componentes principales
- **InspectorHeader** - Encabezado del inspector
- **ControlsPanel** - Controles de inspección
- **QueuesSection** - Sección de descubrimiento de colas
- **MessagesPanel** - Panel de lista de mensajes
- **DetailPanel** - Panel de detalles del mensaje
- **RequeuePanel** - Panel de reencolado

#### Componentes base
- **AlertBox** - Alertas reutilizables
- **TabBar** - Navegación por tabs
- **CodeViewer** - Visor de código
- **MetadataTable** - Tabla de metadatos
- **CopyButton** - Botón copiar al portapapeles
- **QueueCard** - Tarjeta de cola
- **MessageItem** - Elemento de mensaje

**Beneficio:** Componentes pequeños, enfocados, reutilizables

### 📁 `views/`
**Propósito:** Páginas/vistas principales

- **Inspector.vue** - Vista del Inspector (orquesta composables y componentes)
- **Dashboard.vue** - Vista del Dashboard

**Cambio:** Ahora mucho más limpio, sin lógica amontonada

## Flujo de Datos

```
Componente (sections) 
    ↓ (useComposable)
Composable (useQueues, useMessages)
    ↓ (llamadas async)
Services (rabbitService)
    ↓ (requests HTTP)
Backend API
```

## Ejemplo de Uso: Cargar Colas

### Antes (monolítico)
```typescript
// Todo en Inspector.vue
async function loadQueues() {
  queues.value = await rabbitApi.listQueues();
  // ... 20 líneas más de lógica
}
```

### Después (modular)
```typescript
// En Inspector.vue (limpio)
const queues = useQueues();
await queues.loadQueues();

// Lógica en composable (testeable)
// src/composables/useQueues.ts
export function useQueues() {
  async function loadQueues() { /* lógica */ }
  return { loadQueues, /* ... */ };
}

// Servicio (acceso a API)
// src/services/rabbit.service.ts
export const rabbitService = {
  listQueues() { return fetch(...) }
};
```

## Migración de Inspector.vue

### Antes
- 600+ líneas en un solo archivo
- Lógica mezclada con UI
- Difícil de testear
- Difícil de reutilizar

### Después
- 150 líneas (limpio, legible)
- Lógica en composables y servicios
- Fácil de testear
- Componentes reutilizables

## Ventajas de Esta Arquitectura

1. **Separación de Responsabilidades** - Cada archivo hace una cosa bien
2. **Reutilización** - Composables usables en múltiples vistas
3. **Testabilidad** - Lógica pura, fácil de testear
4. **Escalabilidad** - Fácil agregar nuevas features
5. **Mantenibilidad** - Cambios localizados, impacto mínimo
6. **Legibilidad** - Código más claro y organizado

## Próximos Pasos (Opcionales)

- Agregar Pinia para estado global si se necesita
- Crear más composables reutilizables
- Crear composables para Dashboard
- Agregar tests unitarios
- Usar path aliases (@/components, @/utils, etc.)
