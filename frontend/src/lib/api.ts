export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function apiFetch(endpoint: string, options: RequestInit = {}, retries = 3, backoff = 1000) {
  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const isLocalStoragePreferred = typeof window !== 'undefined'
    ? (!window.location.pathname.startsWith('/admin') && !endpoint.startsWith('/admin'))
    : true;

  const sessionToken = typeof window !== 'undefined'
    ? (isLocalStoragePreferred
        ? (localStorage.getItem('sessionToken') || sessionStorage.getItem('sessionToken'))
        : (sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken'))
      )
    : null;
  
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (sessionToken) {
    defaultHeaders['Authorization'] = `Bearer ${sessionToken}`;
  } else {
    console.warn(`apiFetch: No sessionToken found in storage for ${endpoint}`);
  }
  
  if (endpoint.includes('/merchant/payments')) {
    console.log(`apiFetch to ${endpoint} using token: ${sessionToken}`);
  }

  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });
      
      // If we got a 401 or 403, it's an auth issue, not a network issue, so return immediately
      if (response.status === 401 || response.status === 403) {
        return response;
      }
      
      return response;
    } catch (err: any) {
      lastError = err;
      if (i < retries - 1) {
        console.warn(`Fetch failed (attempt ${i + 1}/${retries}) for ${url}. Retrying in ${backoff}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2; // Exponential backoff
      }
    }
  }
  
  console.error(`CRITICAL ERROR: API request failed after ${retries} attempts.`, {
    url,
    method: options.method || 'GET',
    apiUrl: API_URL,
    error: lastError
  });
  
  if (lastError.message === 'Failed to fetch') {
    throw new Error(`Failed to connect to backend at ${API_URL}. Please check if the server is running and CORS is configured.`);
  }

  throw lastError;
}
