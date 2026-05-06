import type { InspectedMessage, QueueInfo, RabbitConfig, RequeueResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface RequeuePayload {
  limit: number;
  targetExchange?: string;
  targetRoutingKey?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch {
    throw new Error(
      `No se pudo conectar con el backend en ${API_BASE_URL}. Verifica que Nest este encendido y reiniciado con CORS_ORIGIN=*`,
    );
  }

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;

    try {
      const body = (await response.json()) as { message?: unknown; detail?: unknown };
      const details = [body.message, body.detail]
        .filter(Boolean)
        .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
        .join(' - ');
      message = details || message;
    } catch {
      message = await response.text();
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const rabbitApi = {
  apiBaseUrl: API_BASE_URL,

  getConfig(): Promise<RabbitConfig> {
    return request<RabbitConfig>('/rabbit/config');
  },

  getQueueInfo(queue: string): Promise<QueueInfo> {
    return request<QueueInfo>(`/rabbit/queues/${encodeURIComponent(queue)}`);
  },

  getMessages(queue: string, limit: number): Promise<InspectedMessage[]> {
    return request<InspectedMessage[]>(
      `/rabbit/queues/${encodeURIComponent(queue)}/messages?limit=${limit}`,
    );
  },

  requeue(queue: string, payload: RequeuePayload): Promise<RequeueResult> {
    return request<RequeueResult>(`/rabbit/queues/${encodeURIComponent(queue)}/requeue`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
