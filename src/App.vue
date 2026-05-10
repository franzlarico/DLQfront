<script setup lang="ts">
import { BarChart3, Database, AlertCircle } from 'lucide-vue-next';
import { ref } from 'vue';
import Inspector from './views/Inspector.vue';
import Dashboard from './views/Dashboard.vue';

const currentView = ref<'inspector' | 'dashboard'>('inspector');
</script>

<template>
  <div class="app-container">
    <!-- Navigation -->
    <nav class="app-nav">
      <div class="nav-brand">
        <Database :size="24" />
        <div class="brand-text">
          <h1>RabbitMQ DLQ</h1>
          <p>Console de Gestion</p>
        </div>
      </div>
      
      <div class="nav-buttons">
        <button
          class="nav-button"
          :class="{ active: currentView === 'inspector' }"
          @click="currentView = 'inspector'"
          title="Inspector de DLQ"
        >
          <Database :size="20" />
          <span>Inspector</span>
        </button>
        <button
          class="nav-button"
          :class="{ active: currentView === 'dashboard' }"
          @click="currentView = 'dashboard'"
          title="Panel de Observabilidad"
        >
          <BarChart3 :size="20" />
          <span>Observabilidad</span>
        </button>
      </div>

      <div class="nav-info">
        <AlertCircle :size="18" />
        <span>v0.1.0</span>
      </div>
    </nav>

    <!-- Content -->
    <main class="app-content">
      <Inspector v-if="currentView === 'inspector'" />
      <Dashboard v-else />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-secondary);
}

.app-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  box-shadow: none;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--color-primary);
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-text h1 {
  font-size: var(--font-size-lg);
  margin: 0;
  font-weight: 700;
}

.brand-text p {
  font-size: var(--font-size-xs);
  margin: 0;
  font-weight: 500;
  color: var(--color-text-tertiary);
}

.nav-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-xl);
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid transparent;
  border-radius: 10px;
  font-weight: 600;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-base);
  position: relative;
}

.nav-button:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-tertiary);
}

.nav-button.active {
  color: var(--color-primary);
  background: var(--color-primary-lighter);
  border-color: rgba(15, 118, 110, 0.18);
  box-shadow: 0 0 0 1px rgba(15, 118, 110, 0.06) inset;
}

.nav-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-weight: 600;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-secondary);
  flex-shrink: 0;
  white-space: nowrap;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .app-nav {
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }

  .nav-brand {
    width: 100%;
  }

  .nav-buttons {
    width: 100%;
  }

  .nav-button {
    flex: 1;
  }

  .nav-info {
    width: 100%;
    justify-content: center;
  }
}
</style>

