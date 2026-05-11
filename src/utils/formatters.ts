import type { InspectedMessage } from '../types';

/**
 * Format any value as JSON string with proper indentation
 */
export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Format date to locale string (Spanish Bolivia format)
 */
export function fullDate(value: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

/**
 * Get message title from message ID or properties
 */
export function getMessageTitle(message: InspectedMessage): string {
  const messageId = message.properties.messageId;
  if (typeof messageId === 'string' && messageId.length > 0) return messageId;
  if (message.id.startsWith('msg-')) {
    const match = /^msg-([^-]+)-(\d+)$/.exec(message.id);
    if (match) return `msg-${match[1]}#${match[2]}`;
  }
  return message.id;
}

/**
 * Get DLQ reason from message metadata
 */
export function getDlqReason(message: InspectedMessage): string {
  return message.metadata?.dlq?.latestReason ?? 'sin razón';
}

/**
 * Get death count from message metadata
 */
export function getDeathCount(message: InspectedMessage): number {
  return message.metadata?.dlq?.deathCount ?? 0;
}

/**
 * Get arrived time from message metadata
 */
export function getArrivedTime(message: InspectedMessage): string {
  const latestTime = message.metadata?.dlq?.latestTime;
  if (!latestTime) return '-';
  return fullDate(latestTime);
}

/**
 * Get original exchange from message
 */
export function getOriginalExchange(message: InspectedMessage): string {
  return message.inferredOriginalExchange || '-';
}
