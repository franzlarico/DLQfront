export interface RabbitConfig {
  urlConfigured: boolean;
  managementUrlConfigured: boolean;
  prefetch: number;
  defaultDlq?: string;
  defaultRequeueExchange?: string;
  defaultRequeueRoutingKey?: string;
}

export interface QueueInfo {
  queue: string;
  messageCount: number;
  consumerCount: number;
}

export interface QueueListItem {
  name: string;
  messageCount: number;
  isDlq: boolean;
}

export interface InspectedMessage {
  id: string;
  body: unknown;
  bodyEncoding: 'json' | 'utf8' | 'base64' | 'empty';
  sizeBytes: number;
  fields: {
    deliveryTag: number;
    redelivered: boolean;
    exchange: string;
    routingKey: string;
  };
  properties: Record<string, unknown>;
  death?: Array<Record<string, unknown>>;
  inferredOriginalExchange?: string;
  inferredOriginalRoutingKeys: string[];
  metadata: {
    sourceQueue: string;
    inspectedAt: string;
    body: {
      encoding: string;
      sizeBytes: number;
      contentType?: string;
      contentEncoding?: string;
    };
    delivery: {
      deliveryTag: number;
      redelivered: boolean;
      exchange: string;
      routingKey: string;
    };
    dlq: {
      deathCount: number;
      latestReason?: string;
      latestQueue?: string;
      latestExchange?: string;
      latestTime?: string;
      latestRoutingKeys: string[];
      firstDeathQueue?: string;
      firstDeathExchange?: string;
      firstDeathReason?: string;
      lastDeathQueue?: string;
      lastDeathExchange?: string;
      lastDeathReason?: string;
    };
    properties: Record<string, unknown>;
    headers: Record<string, unknown>;
    rawDeath: Array<Record<string, unknown>>;
  };
  inspectedAt: string;
}

export interface RequeueResult {
  sourceQueue: string;
  targetExchange: string;
  targetRoutingKey?: string;
  targetRoutingKeys: string[];
  requested: number;
  requeued: number;
  stoppedBecauseQueueWasEmpty: boolean;
  messages: InspectedMessage[];
}

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
  // Complete message data storage
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

export interface RequeueJobDetails {
  id: string;
  sourceQueue: string;
  targetExchange?: string;
  targetRoutingKey?: string;
  requestedCount: number;
  requeuedCount: number;
  status: string;
  requestedBy: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  targetRoutingKeys: string[];
  items: Array<{
    id: string;
    fingerprint?: string;
    messageId?: string;
    routingKey?: string;
    status: string;
    createdAt: string;
  }>;
}
