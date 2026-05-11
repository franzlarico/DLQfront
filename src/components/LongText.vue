<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  text: string
}>()

const expanded = ref(false)

const MAX_LENGTH = 300

const isLong = computed(() => {
  return props.text.length > MAX_LENGTH
})

const displayText = computed(() => {
  if (expanded.value || !isLong.value) {
    return props.text
  }

  return props.text.slice(0, MAX_LENGTH) + '...'
})

const toggleExpand = () => {
  expanded.value = !expanded.value
}

const copyText = async () => {
  await navigator.clipboard.writeText(props.text)

  alert('Copiado al portapapeles ✅')
}
</script>

<template>
  <div class="long-text-container">
    <pre>{{ displayText }}</pre>

    <div class="actions">
      <button v-if="isLong" @click="toggleExpand">
        {{ expanded ? 'Ver menos' : 'Ver más' }}
      </button>

      <button @click="copyText">
        Copiar
      </button>
    </div>
  </div>
</template>