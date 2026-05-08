<script setup lang="ts">
import { BarChart3, Database } from 'lucide-vue-next';
import { ref } from 'vue';
import Inspector from './views/Inspector.vue';
import Dashboard from './views/Dashboard.vue';

const currentView = ref<'inspector' | 'dashboard'>('inspector');
</script>

<template>
  <div class="app-container">
    <!-- Navigation -->
    <nav class="app-nav">
      <button
        class="nav-button"
        :class="{ active: currentView === 'inspector' }"
        @click="currentView = 'inspector'"
      >
        <Database :size="18" />
        <span>Inspector DLQ</span>
      </button>
      <button
        class="nav-button"
        :class="{ active: currentView === 'dashboard' }"
        @click="currentView = 'dashboard'"
      >
        <BarChart3 :size="18" />
        <span>Observabilidad</span>
      </button>
    </nav>

    <!-- Views -->
    <Inspector v-if="currentView === 'inspector'" />
    <Dashboard v-else />
  </div>
</template>


<style scoped>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
}

#app {
  width: 100%;
  min-height: 100vh;
}

.app-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #dce3eb;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
  padding: 16px;
  border: none;
  background: transparent;
  color: #607086;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 200ms ease;
  border-bottom: 3px solid transparent;
}

.nav-button:hover {
  background: #f9fbfc;
  color: #334155;
}

.nav-button.active {
  color: #1f6feb;
  border-bottom-color: #1f6feb;
  background: linear-gradient(to bottom, rgba(31, 111, 235, 0.05), transparent);
}

.app-container > :deep(*) {
  flex: 1;
}
</style>
