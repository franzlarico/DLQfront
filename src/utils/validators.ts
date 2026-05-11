/**
 * Clamp an integer value between min and max
 */
export function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

/**
 * Check if queue name is valid
 */
export function isValidQueueName(queue: string): boolean {
  return queue.trim().length > 0;
}

/**
 * Validate requeue parameters
 */
export function validateRequeueParams(
  queueName: string,
  limit: number,
  limitMin: number,
  limitMax: number,
): string | null {
  if (!isValidQueueName(queueName)) {
    return 'Selecciona una cola DLQ.';
  }

  const clampedLimit = clampInteger(limit, limitMin, limitMax, limitMin);
  if (clampedLimit !== limit) {
    return `Límite debe estar entre ${limitMin} y ${limitMax}`;
  }

  return null;
}
