export interface RabbitConfig {
  urlConfigured: boolean;
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
