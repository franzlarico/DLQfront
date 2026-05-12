<template>
  <section class="controls-panel">
    <div class="quick-controls">
      <div class="control-item">
        <label class="label-text">Límite de inspección</label>
        <input
          :value="inspectLimit"
          type="range"
          :min="limitMin"
          :max="limitMax"
          class="range-slider"
          @input="$emit('update:inspectLimit', Number(($event.target as HTMLInputElement).value))"
        />
        <div class="control-footer">
          <span class="value-badge">{{ inspectLimit }}</span>
          <small>Máximo de mensajes a mostrar ({{ limitMin }}-{{ limitMax }})</small>
        </div>
      </div>

      <div class="control-item">
        <label class="label-text">Auto-actualizar</label>
        <label class="switch-label">
          <input
            :checked="autoRefresh"
            type="checkbox"
            @change="$emit('update:autoRefresh', ($event.target as HTMLInputElement).checked)"
          />
          <span class="switch-toggle"></span>
        </label>
        <small>Cada 8 segundos</small>
      </div>

      <div class="control-item">
        <label class="label-text">Cola activa</label>
        <div class="queue-display">
          {{ queueName || 'Selecciona una cola...' }}
        </div>
      </div>
    </div>

    <div class="nacos-section">
      <div class="section-title">Configuración NACOS</div>
      
      <div class="nacos-inputs">
        <div class="input-group">
          <label class="label-text">MANDANTE</label>
          <div class="input-wrapper">
            <span class="input-icon">🌐</span>
            <select v-model="localNamespace" class="select-input">
              <option value="">Selecciona un namespace...</option>
              <option value="10000365">10000365</option>
              <option value="10000265">10000265</option>
              <option value="10000291">10000291</option>
            </select>
          </div>
          <small>Namespace de Nacos que se enviará al backend</small>
        </div>

        <div class="input-group">
          <label class="label-text">AMBIENTE</label>
          <div class="input-wrapper">
            <span class="input-icon">🌐</span>
            <select v-model="localEnv" class="select-input">
              <option value="">Selecciona un ambiente...</option>
              <option value="QAS">QAS</option>
              <option value="PRD">PRD</option>
            </select>
          </div>
          <small>Ambiente NACOS que se enviará al backend</small>
        </div>

        <div class="input-group">
          <label class="label-text">VHOST</label>
          <div class="input-wrapper">
            <span class="input-icon">🔐</span>
            <select v-model="localVhost" class="select-input">
              <option value="/">/</option>
              <option value="/internal">/internal</option>
            </select>
          </div>
          <small>VHost AMQP que se usará al reconfigurar RabbitMQ</small>
        </div>
      </div>

      <button
        :disabled="loading"
        :class="{ loading, success, error: !!error }"
        class="reload-button"
        @click="applyNacosConfig"
      >
        <span class="icon">{{ loading ? '⟳' : success ? '✓' : '⟳' }}</span>
        Acceder
      </button>

      <transition name="fade">
        <small v-if="error" style="color: #ef4444;">{{ error }}</small>
        <small v-else-if="success" style="color: #10b981;">Recarga completada</small>
      </transition>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useNacosConfig } from '../../composables/useNacosConfig';

interface Props {
  inspectLimit: number;
  autoRefresh: boolean;
  queueName: string;
  limitMin?: number;
  limitMax?: number;
}

withDefaults(defineProps<Props>(), {
  limitMin: 1,
  limitMax: 100,
});

defineEmits<{
  (e: 'update:inspectLimit', value: number): void;
  (e: 'update:autoRefresh', value: boolean): void;
}>();

const { nacosNamespace, nacosEnv, nacosVhost, loading, error, applyNacos } = useNacosConfig();
const localNamespace = ref(nacosNamespace.value || '');
const localEnv = ref(nacosEnv.value || '');
const localVhost = ref(nacosVhost.value || '/');
const success = ref(false);

onMounted(() => {
  localNamespace.value = nacosNamespace.value || '';
  localEnv.value = nacosEnv.value || '';
  localVhost.value = nacosVhost.value || '/';
});

async function applyNacosConfig() {
  success.value = false;
  const result = await applyNacos(
    localNamespace.value.trim(),
    localEnv.value.trim(),
    localVhost.value.trim() || '/',
  );
  if (result) {
    nacosNamespace.value = localNamespace.value.trim();
    nacosEnv.value = localEnv.value.trim();
    nacosVhost.value = localVhost.value.trim() || '/';
    success.value = true;
    setTimeout(() => {
      success.value = false;
    }, 2000);
  }
}
</script>

<style scoped>
.controls-panel {
  padding: 20px 30px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.quick-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.label-text {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.range-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #14b8a6;
  cursor: pointer;
}

.range-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #14b8a6;
  cursor: pointer;
  border: none;
}

.control-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.value-badge {
  background: #dbeafe;
  color: #0369a1;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  width: fit-content;
}

.switch-label input {
  display: none;
}

.switch-toggle {
  width: 44px;
  height: 24px;
  background: #d1d5db;
  border-radius: 12px;
  position: relative;
  transition: background 150ms;
}

.switch-label input:checked ~ .switch-toggle {
  background: #14b8a6;
}

.switch-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 150ms;
}

.switch-label input:checked ~ .switch-toggle::after {
  transform: translateX(20px);
}

.queue-display {
  padding: 10px 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  color: #1f2937;
  word-break: break-all;
}

.nacos-section {
  padding: 20px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16px;
}

.nacos-inputs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  pointer-events: none;
}

.text-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  color: #1f2937;
  font-size: 13px;
  font-family: inherit;
  transition: border 150ms;
}

.text-input:focus {
  outline: none;
  border-color: #14b8a6;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.1);
}

.select-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  color: #1f2937;
  font-size: 13px;
  font-family: inherit;
  transition: border 150ms;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231f2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 32px;
}

.select-input:focus {
  outline: none;
  border-color: #14b8a6;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.1);
}

.select-input option {
  color: #1f2937;
  background: white;
}

.reload-button {
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 6px;
  background: #14b8a6;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 150ms;
}

.reload-button:hover:not(:disabled) {
  background: #0d9488;
}

.reload-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reload-button.loading {
  background: #9ca3af;
}

.reload-button.success {
  background: #10b981;
}

.reload-button.error {
  background: #ef4444;
}

.icon {
  font-size: 14px;
}

small {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 150ms;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .controls-panel {
    padding: 16px;
  }

  .quick-controls {
    grid-template-columns: 1fr;
  }

  .nacos-inputs {
    grid-template-columns: 1fr;
  }
}
</style>