/**
 * DEPRECATED: Use rabbitService from src/services/rabbit.service.ts instead
 * 
 * This file is kept for backward compatibility only.
 * All new code should import from the services layer.
 */

import { rabbitService } from '../services/rabbit.service';

// Re-export for backward compatibility
export const rabbitApi = rabbitService;

