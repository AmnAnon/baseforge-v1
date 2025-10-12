// Base API error type for OnchainKit responses
export interface APIError {
  code: string;    // Error code
  error: string;   // Error details
  message: string; // Error message
}

// Type guard for API responses
export function isApiError(response: unknown): response is APIError {
  return (
    response !== null && 
    typeof response === 'object' && 
    'error' in response
  );
}
