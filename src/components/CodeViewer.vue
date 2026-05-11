<template>
    <pre v-if="content" class="code"><code>{{ content }}</code></pre>
</template>
<script setup lang="ts">interface Props { content: string; } defineProps<Props>(); </script>
<style
    scoped>
    .code {
        flex: 1;
        overflow-y: auto;
        background: var(--color-bg-tertiary);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: var(--spacing-lg);
        font-family: 'Monaco', 'Courier New', monospace;
        font-size: var(--font-size-xs);
        color: var(--color-text-primary);
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        max-height: 420px;
        margin: 0;
    }

    code {
        color: inherit;
        font-family: inherit;
    }
</style>
