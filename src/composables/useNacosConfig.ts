import { ref } from 'vue';
import { rabbitService } from '../services';
import type { RabbitConfig } from '../types';

const nacosNamespace = ref<string>('');
const nacosEnv = ref<string>('');
const loading = ref(false);
const error = ref<string | null>(null);
const currentConfig = ref<RabbitConfig | null>(null);

async function fetchConfig(): Promise<RabbitConfig | null> {
	try {
		currentConfig.value = await rabbitService.getConfig();
		return currentConfig.value;
	} catch (err) {
		error.value = err instanceof Error ? err.message : String(err);
		return null;
	}
}

async function applyNacos(namespace: string, env: string, timeoutMs = 30000): Promise<RabbitConfig | null> {
	loading.value = true;
	error.value = null;
	try {
		await rabbitService.setNacosConfig(namespace, env);

		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			try {
				const status = await rabbitService.getNacosStatus();
				if (status.reloaded) {
					await fetchConfig();
					return currentConfig.value;
				}
			} catch {
				// ignore poll errors
			}
			await new Promise((r) => setTimeout(r, 1000));
		}

		error.value = 'Timeout esperando que el backend recargue Nacos.';
		return null;
	} catch (err) {
		error.value = err instanceof Error ? err.message : String(err);
		return null;
	} finally {
		loading.value = false;
	}
}

export function useNacosConfig() {
	return {
		nacosNamespace,
		nacosEnv,
		loading,
		error,
		currentConfig,
		fetchConfig,
		applyNacos,
	};
}

(async () => {
	try {
		currentConfig.value = await rabbitService.getConfig();
	} catch {
		// noop
	}
})();

