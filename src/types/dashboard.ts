export type DashboardWindow = '24h' | '7d' | '30d' | 'all';

export interface DashboardSummary {
  window: DashboardWindow;
  summary: {
    totalMessages: number;
    totalRequeued: number;
    uniqueQueues: number;
    averageRequeueSize: number;
  };
}

export interface QueueDistributionItem {
  queue: string;
  totalMessages: number;
  requeuedMessages: number;
  failedOperations: number;
}

export interface ExceptionSummaryItem {
  reason: string;
  count: number;
}

export interface ActivityItem {
  _id?: string;
  eventType: string;
  sourceQueue: string;
  targetExchange?: string;
  targetRoutingKey?: string;
  messageId?: string;
  messageSize?: number;
  messageCount?: number;
  successCount?: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  duration?: number;
  arrivedAtDlqTime?: string;
  createdAt: string;
  updatedAt?: string;
  errorMessage?: string;
  messageBody?: unknown;
  messageProperties?: Record<string, unknown>;
  messageHeaders?: Record<string, unknown>;
  dlqMetadata?: Record<string, unknown>;
  messageBodyEncoding?: string;
  originalExchange?: string;
  originalRoutingKeys?: string[];
}

export interface HealthResponse {
  status: 'up' | 'down';
  dependencies: {
    database: DependencyHealth;
    rabbitAmqp: DependencyHealth;
    rabbitManagement: DependencyHealth;
  };
}

export interface DependencyHealth {
  status: 'up' | 'down';
  detail?: string;
}
