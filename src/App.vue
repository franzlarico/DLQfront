<script setup lang="ts">
import { ref } from 'vue';
import Inspector from './views/Inspector.vue';
import Dashboard from './views/Dashboard.vue';

type View = 'inspector' | 'dashboard';

const currentView = ref<View>('inspector');

function switchView(view: View): void {
  currentView.value = view;
}
</script>

<template>
  <div class="app-container">
    <Inspector v-if="currentView === 'inspector'" @view-dashboard="switchView('dashboard')" />
    <Dashboard v-else-if="currentView === 'dashboard'" @back-to-inspector="switchView('inspector')" />
  </div>
</template>

<style>
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
}
</style>
