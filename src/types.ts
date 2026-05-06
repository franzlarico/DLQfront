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

export type DashboardWindow = 'today' | '24h' | '7d';

export interface DashboardSummary {
  window: DashboardWindow;
  totalDeadLetters: number;
  activeQueues: number;
  requeuedToday: number;
  pendingOlderThan24h: number;
  recoveryRate: number;
  avgRecoveryMinutes: number;
}

export interface QueueDistributionItem {
  queue: string;
  currentMessages: number;
  peakMessages: number;
  trendDelta: number;
  sharePercent: number;
}

export interface ExceptionSummaryItem {
  reason: string;
  count: number;
  percentage: number;
  queue?: string;
  latestSeenAt?: string;
}

export interface ActivityItem {
  id: string;
  kind: 'message' | 'requeue-job';
  action: string;
  queue: string;
  status: string;
  fingerprint?: string;
  detail?: string;
  createdAt: string;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
  dependencies: {
    database: DependencyHealth;
    rabbitAmqp: DependencyHealth;
    rabbitManagement: DependencyHealth;
  };
}

export interface DependencyHealth {
  status: 'up' | 'down';
  detail?: string;
  driver?: string;
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
