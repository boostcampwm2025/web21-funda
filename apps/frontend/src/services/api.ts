export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** API 표준 응답 포맷 */
interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  result: T;
}

/** 요청 재시도 제어를 위한 옵션 */
type RequestRetryOptions = {
  hasRetried: boolean;
};

/**
 * 동시에 여러 요청이 401을 받았을 때 refresh 요청을 하나로 합치기 위한 상태값
 */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * 리프레시 토큰 요청을 실제로 실행한다.
 *
 * @returns {Promise<boolean>} 갱신 성공 여부
 */
async function requestRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // 쿠키 전달 필수
    });
    if (response.status === 400) {
      return false;
    }

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * [인증 갱신] 인증 만료(401) 시 리프레시 토큰 쿠키를 이용하여 세션을 갱신한다.
 * 동시 요청이 있을 경우 하나의 refresh 요청 결과를 공유한다.
 *
 * @returns {Promise<boolean>} 갱신 성공 여부
 */
async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = requestRefreshToken().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * [공통] Response 원본이 필요한 요청용 인증 재시도 함수.
 * (예: SSE 스트리밍처럼 JSON 파싱 전에 Response 본문 스트림을 직접 읽는 경우)
 *
 * @param endpoint API 엔드포인트(상대경로) 또는 절대 URL
 * @param options Fetch 옵션
 * @param retryOptions 내부 재시도 상태 관리용
 */
export async function fetchWithAuthRetry(
  endpoint: string,
  options: RequestInit = {},
  retryOptions: RequestRetryOptions = { hasRetried: false },
): Promise<Response> {
  const isAbsoluteUrl = /^https?:\/\//.test(endpoint);
  const url = isAbsoluteUrl
    ? endpoint
    : `${BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const response = await fetch(url, {
    ...options,
    credentials: options.credentials ?? 'include',
  });

  const isUnauthorized = response.status === 401;
  const isRefreshEndpoint = endpoint.includes('/auth/refresh');

  if (isUnauthorized && !retryOptions.hasRetried && !isRefreshEndpoint) {
    const isRefreshed = await tryRefreshToken();
    if (isRefreshed) {
      return fetchWithAuthRetry(endpoint, options, { hasRetried: true });
    }
  }

  return response;
}

/**
 * [공통] API 응답의 유효성을 검사하고 결과를 반환한다.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const responseBody = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  // 1. HTTP 상태 코드가 성공 범위(2xx)가 아닌 경우
  if (!response.ok) {
    const errorMessage = responseBody?.message || `HTTP Error: ${response.status}`;
    throw new Error(errorMessage);
  }

  // 2. 응답 본문이 없거나 success 필드가 false인 경우
  if (!responseBody) throw new Error('응답 본문이 비어 있습니다.');
  if (!responseBody.success) throw new Error(responseBody.message || '요청 처리에 실패했습니다.');

  return responseBody.result;
}

/**
 * [핵심] Fetch API를 기반으로 한 전역 요청 함수.
 * 인증 만료 시 자동 재시도 로직을 포함한다.
 *
 * @param method HTTP 메서드
 * @param endpoint API 엔드포인트 (예: '/users/me')
 * @param body 요청 바디 (POST, PUT 등)
 * @param options 추가적인 Fetch 설정
 * @param retryOptions 내부 재시도 상태 관리용
 */
async function baseRequest<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options: RequestInit = {},
  retryOptions: RequestRetryOptions = { hasRetried: false },
): Promise<T> {
  const isFormData = body instanceof FormData;

  const headers: HeadersInit = {
    // FormData가 아닐 때만 기본적으로 JSON 타입을 설정
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const response = await fetchWithAuthRetry(
    endpoint,
    {
      ...options,
      method,
      headers,
      body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    },
    retryOptions,
  );

  return handleResponse<T>(response);
}

/**
 * 외부에서 사용할 API 요청 객체
 */
export const apiFetch = {
  get: <T>(url: string, opt?: RequestInit) => baseRequest<T>('GET', url, undefined, opt),

  delete: <T>(url: string, opt?: RequestInit) => baseRequest<T>('DELETE', url, undefined, opt),

  post: <T>(url: string, body?: unknown, opt?: RequestInit) =>
    baseRequest<T>('POST', url, body, opt),

  put: <T>(url: string, body?: unknown, opt?: RequestInit) => baseRequest<T>('PUT', url, body, opt),

  patch: <T>(url: string, body?: unknown, opt?: RequestInit) =>
    baseRequest<T>('PATCH', url, body, opt),
};
