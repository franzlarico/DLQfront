import type {
  ActivityItem,
  DashboardSummary,
  DashboardWindow,
  ExceptionSummaryItem,
  HealthResponse,
  InspectedMessage,
  QueueDistributionItem,
  QueueInfo,
  QueueListItem,
  RabbitConfig,
  RequeueJobDetails,
  RequeueResult,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface RequeuePayload {
  limit: number;
  targetExchange?: string;
  targetRoutingKey?: string;
}

interface RequeueJobPayload extends RequeuePayload {
  sourceQueue: string;
  requestedBy?: string;
}

/**
 * Base HTTP request handler with error handling and request ID tracking
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const requestId = globalThis.crypto?.randomUUID?.() ?? `web-${Date.now()}`;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-request-id': requestId,
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

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * RabbitMQ API Service
 * Handles all communication with the backend API
 */
export const rabbitService = {
  apiBaseUrl: API_BASE_URL,

  // ============= Config =============
  getConfig(): Promise<RabbitConfig> {
    return request<RabbitConfig>('/rabbit/config');
  },

  // ============= Queues =============
  listQueues(): Promise<QueueListItem[]> {
    return request<QueueListItem[]>('/rabbit/queues');
  },

  getQueueInfo(queue: string): Promise<QueueInfo> {
    return request<QueueInfo>(`/rabbit/queues/${encodeURIComponent(queue)}`);
  },

  getMessages(queue: string, limit: number): Promise<InspectedMessage[]> {
    return request<InspectedMessage[]>(
      `/rabbit/queues/${encodeURIComponent(queue)}/messages?limit=${limit}`,
    );
  },

  // ============= Requeue =============
  requeue(queue: string, payload: RequeuePayload): Promise<RequeueResult> {
    return request<RequeueResult>(`/rabbit/queues/${encodeURIComponent(queue)}/requeue`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createRequeueJob(payload: RequeueJobPayload): Promise<RequeueJobDetails> {
    return request<RequeueJobDetails>('/requeue/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getRequeueJob(id: string): Promise<RequeueJobDetails> {
    return request<RequeueJobDetails>(`/requeue/jobs/${encodeURIComponent(id)}`);
  },

  // ============= Dashboard =============
  getDashboardSummary(window: DashboardWindow): Promise<DashboardSummary> {
    return request<DashboardSummary>(`/dashboard/summary?window=${encodeURIComponent(window)}`);
  },

  getDashboardQueues(window: DashboardWindow): Promise<QueueDistributionItem[]> {
    return request<QueueDistributionItem[]>(`/dashboard/queues?window=${encodeURIComponent(window)}`);
  },

  getDashboardExceptions(window: DashboardWindow): Promise<ExceptionSummaryItem[]> {
    return request<ExceptionSummaryItem[]>(`/dashboard/exceptions?window=${encodeURIComponent(window)}`);
  },

  getDashboardActivity(window: DashboardWindow, limit = 12): Promise<ActivityItem[]> {
    return request<ActivityItem[]>(
      `/dashboard/activity?window=${encodeURIComponent(window)}&limit=${encodeURIComponent(limit)}`,
    );
  },

  getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/dashboard/health').catch(() =>
      request<HealthResponse>('/health'),
    );
  },

  // ============= Nacos (admin) =============
  /**
   * Envía namespace y env al backend para que recargue Nacos
   */
  setNacosConfig(namespace: string, env: string): Promise<void> {
    return request<void>('/nacos/reload', {
      method: 'POST',
      body: JSON.stringify({ namespace, env }),
    });
  },

  /**
   * Consulta el estado de la recarga de Nacos
   */
  getNacosStatus(): Promise<{ reloaded: boolean; timestamp?: string }> {
    return request<{ reloaded: boolean; timestamp?: string }>('/nacos/status');
  },

  async downloadDashboardExport(window: DashboardWindow, format: 'json' | 'csv'): Promise<Blob> {
    const requestId = globalThis.crypto?.randomUUID?.() ?? `web-${Date.now()}`;
    const response = await fetch(
      `${API_BASE_URL}/dashboard/export?window=${encodeURIComponent(window)}&format=${encodeURIComponent(format)}`,
      {
        headers: {
          Accept: format === 'json' ? 'application/json' : 'text/csv',
          'x-request-id': requestId,
        },
      },
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.blob();
  },
};
