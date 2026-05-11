export interface ApiError extends Error {
  status?: number;
  details?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
}
