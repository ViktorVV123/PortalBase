// --- src/services/api.ts ------------------------------------------------------
// Авторизация: AccessId / RefreshId в cookies + «тихий» refresh через POST /refresh
// С защитой от race condition при множественных параллельных запросах

import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosError,
    AxiosResponse,
} from 'axios';

/* ───────── 1. helpers: cookie read / write ──────────────────────────────── */
const getCookie = (n: string): string | undefined => {
    const value = decodeURIComponent(
        document.cookie.replace(
            new RegExp(
                '(?:(?:^|.*;)\\s*' +
                n.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&') +
                '\\s*=\\s*([^;]*).*$)|^.*$',
            ),
            '$1',
        ),
    );
    return value || undefined;
};

const setCookie = (n: string, v: string, days = 1) => {
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${n}=${encodeURIComponent(v)}; expires=${exp}; path=/; SameSite=Strict`;
};

const deleteCookie = (n: string) => {
    document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;
};

/* ───────── 2. URL-ы и константы ────────────────────────────────────────── */

const API_URL = 'https://csc-fv.pro.lukoil.com/api';
const REFRESH_URL = `${API_URL}/refresh`;
const IDM_URL = 'https://csc-idm.pro.lukoil.com/?env=FrmV';

const isProdHost = window.location.hostname === 'csc-fv.pro.lukoil.com';

// DEV токен — ТОЛЬКО для локальной разработки (на проде пустой)
const DEV_ACCESS_TOKEN = '14f7fe40-8c3f-4be6-9522-60839be4cc38';

/* ═══════════════════════════════════════════════════════════════════════════
   ЛОГИРОВАНИЕ AUTH СОБЫТИЙ
═══════════════════════════════════════════════════════════════════════════ */

type AuthEventType =
    | 'REQUEST_SENT'
    | 'REQUEST_SUCCESS'
    | 'REQUEST_401'
    | 'REQUEST_ERROR'
    | 'REFRESH_START'
    | 'REFRESH_SUCCESS'
    | 'REFRESH_FAIL'
    | 'TOKENS_UPDATED'
    | 'TOKENS_CLEARED'
    | 'RETRY_REQUEST'
    | 'QUEUE_ADD'
    | 'QUEUE_PROCESS'
    | 'SESSION_EXPIRED';

type AuthEvent = {
    id: number;
    timestamp: string;
    type: AuthEventType;
    details: Record<string, any>;
};

let eventCounter = 0;
const authHistory: AuthEvent[] = [];
const MAX_HISTORY = 200;

// Forward declaration для использования в logAuthEvent
let memoryAccessToken = '';
let memoryRefreshToken = '';

function logAuthEvent(type: AuthEventType, details: Record<string, any> = {}) {
    const event: AuthEvent = {
        id: ++eventCounter,
        timestamp: new Date().toISOString(),
        type,
        details: {
            ...details,
            _tokens: {
                memoryAccess: memoryAccessToken ? memoryAccessToken.slice(0, 25) + '...' : '(empty)',
                memoryRefresh: memoryRefreshToken ? memoryRefreshToken.slice(0, 25) + '...' : '(empty)',
                cookieAccess: getCookie('accessToken')?.slice(0, 25) + '...' || '(empty)',
                cookieRefresh: getCookie('refreshToken')?.slice(0, 25) + '...' || '(empty)',
            },
        },
    };

    authHistory.push(event);
    if (authHistory.length > MAX_HISTORY) {
        authHistory.shift();
    }

    const colors: Record<AuthEventType, string> = {
        REQUEST_SENT: '#9E9E9E',
        REQUEST_SUCCESS: '#4CAF50',
        REQUEST_401: '#FF9800',
        REQUEST_ERROR: '#f44336',
        REFRESH_START: '#2196F3',
        REFRESH_SUCCESS: '#4CAF50',
        REFRESH_FAIL: '#f44336',
        TOKENS_UPDATED: '#8BC34A',
        TOKENS_CLEARED: '#f44336',
        RETRY_REQUEST: '#03A9F4',
        QUEUE_ADD: '#9C27B0',
        QUEUE_PROCESS: '#9C27B0',
        SESSION_EXPIRED: '#D32F2F',
    };

    const icons: Record<AuthEventType, string> = {
        REQUEST_SENT: '📤',
        REQUEST_SUCCESS: '✅',
        REQUEST_401: '⚠️',
        REQUEST_ERROR: '❌',
        REFRESH_START: '🔄',
        REFRESH_SUCCESS: '✅',
        REFRESH_FAIL: '❌',
        TOKENS_UPDATED: '🔑',
        TOKENS_CLEARED: '🗑️',
        RETRY_REQUEST: '🔁',
        QUEUE_ADD: '📋',
        QUEUE_PROCESS: '📋',
        SESSION_EXPIRED: '🚫',
    };

    console.groupCollapsed(
        `%c[AUTH #${event.id}] ${icons[type]} ${type}`,
        `color: ${colors[type]}; font-weight: bold`
    );
    console.log('Time:', event.timestamp);
    console.log('Details:', details);
    console.log('Current Tokens:', event.details._tokens);
    console.groupEnd();

    return event;
}

/* ───────── 3. Читаем токены из URL (если пришли с IdM) ─────────────────── */

let tokensReceivedFromUrl = false;

(function readTokensFromUrl() {
    const search = new URLSearchParams(window.location.search);
    const encoded = search.get('ldapData');
    if (!encoded) return;

    try {
        const jsonStr = atob(decodeURIComponent(encoded));
        const j = JSON.parse(jsonStr);

        if (j.AccessId && j.RefreshId) {
            setCookie('accessToken', j.AccessId);
            setCookie('refreshToken', j.RefreshId);
            tokensReceivedFromUrl = true;
            console.log('[auth] Tokens received from URL (ldapData)');
        }

        // Убираем ldapData из URL
        search.delete('ldapData');
        const newQuery = search.toString();
        const newUrl =
            window.location.pathname +
            (newQuery ? `?${newQuery}` : '') +
            window.location.hash;
        window.history.replaceState({}, '', newUrl);
    } catch (e) {
        console.error('[auth] ldapData parse error:', e);
    }
})();

/* ───────── 4. In-memory хранилище токенов ─────────────────────────────── */

memoryAccessToken = getCookie('accessToken') || '';
memoryRefreshToken = getCookie('refreshToken') || '';

if (!isProdHost && !memoryAccessToken && DEV_ACCESS_TOKEN) {
    memoryAccessToken = DEV_ACCESS_TOKEN;
    console.log('[auth] Using DEV_ACCESS_TOKEN for local development');
}

function syncTokensToCookie() {
    if (memoryAccessToken) {
        setCookie('accessToken', memoryAccessToken);
    }
    if (memoryRefreshToken) {
        setCookie('refreshToken', memoryRefreshToken);
    }
}

function updateTokens(access: string, refresh: string) {
    const prevAccess = memoryAccessToken;
    const prevRefresh = memoryRefreshToken;

    memoryAccessToken = access;
    memoryRefreshToken = refresh;
    syncTokensToCookie();

    logAuthEvent('TOKENS_UPDATED', {
        accessChanged: prevAccess !== access,
        refreshChanged: prevRefresh !== refresh,
        prevAccessPrefix: prevAccess ? prevAccess.slice(0, 20) + '...' : '(empty)',
        newAccessPrefix: access ? access.slice(0, 20) + '...' : '(empty)',
    });
}

function clearTokens() {
    deleteCookie('accessToken');
    deleteCookie('refreshToken');
    memoryAccessToken = '';
    memoryRefreshToken = '';

    logAuthEvent('TOKENS_CLEARED', {});
}

function getAccessToken(): string {
    return memoryAccessToken;
}

/* ───────── 5. Редирект на IdM ─────────────────────────────────────────── */

let isRedirecting = false;

function goToIdm(): void {
    if (isRedirecting) {
        console.warn('[auth] Redirect already in progress');
        return;
    }
    isRedirecting = true;
    clearTokens();

    console.warn('[auth] Session expired. Redirecting to IdM...');

    if (typeof window !== 'undefined' && document.body) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.85);
            display: flex; align-items: center; justify-content: center;
            z-index: 99999; color: white; font-size: 18px; font-family: sans-serif;
        `;
        overlay.innerHTML = '<div>Сессия истекла. Перенаправление на авторизацию...</div>';
        document.body.appendChild(overlay);
    }

    setTimeout(() => {
        window.location.href = IDM_URL;
    }, 300);
}

function handleSessionExpired(reason: string): void {
    logAuthEvent('SESSION_EXPIRED', {
        reason,
        willRedirect: isProdHost,
    });

    if (isProdHost) {
        goToIdm();
    } else {
        console.error('[auth] DEV MODE: Session expired. Clear tokens and refresh page.');
        clearTokens();

        if (typeof window !== 'undefined' && document.body && !document.getElementById('auth-expired-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'auth-expired-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0;
                background: rgba(139, 0, 0, 0.95);
                display: flex; align-items: center; justify-content: center;
                flex-direction: column; gap: 20px;
                z-index: 99999; color: white; font-size: 18px; font-family: sans-serif;
            `;
            overlay.innerHTML = `
                <div style="font-size: 24px; font-weight: bold;">🔒 Сессия истекла</div>
                <div>Причина: ${reason}</div>
                <div style="font-size: 14px; opacity: 0.8;">DEV MODE: На проде был бы редирект на IdM</div>
                <button onclick="location.reload()" style="
                    padding: 12px 24px; font-size: 16px; cursor: pointer;
                    background: white; color: black; border: none; border-radius: 4px;
                ">Обновить страницу</button>
            `;
            document.body.appendChild(overlay);
        }
    }
}

/* ───────── 6. Начальная проверка токенов ────────────────────────────────── */

if (isProdHost && !tokensReceivedFromUrl && !memoryAccessToken) {
    setTimeout(() => {
        if (!memoryAccessToken && !isRedirecting) {
            console.log('[auth] No access token on start, redirecting to IdM');
            handleSessionExpired('NO_ACCESS_TOKEN_ON_START');
        }
    }, 50);
}

/* ───────── 7. Axios instance ─────────────────────────────────────────────── */

export const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

/* ───────── 8. Refresh logic с защитой от race condition ─────────────────── */

let refreshPromise: Promise<string> | null = null;
let refreshFailCount = 0;
const MAX_REFRESH_FAILS = 2;

async function doRefresh(): Promise<string> {
    if (refreshPromise) {
        console.log('[auth] Waiting for existing refresh...');
        return refreshPromise;
    }

    refreshPromise = (async () => {
        const currentRefresh = memoryRefreshToken;

        logAuthEvent('REFRESH_START', {
            usingRefreshToken: currentRefresh ? currentRefresh.slice(0, 25) + '...' : '(empty)',
        });

        if (!currentRefresh) {
            logAuthEvent('REFRESH_FAIL', { reason: 'NO_REFRESH_TOKEN' });
            throw new Error('NO_REFRESH_TOKEN');
        }

        try {
            const { data } = await axios.post<{ AccessId: string; RefreshId: string }>(
                REFRESH_URL,
                undefined,
                {
                    params: { refresh_id: currentRefresh },
                    headers: { accept: 'application/json' },
                    timeout: 15000,
                }
            );

            if (!data.AccessId || !data.RefreshId ||
                data.AccessId.length < 10 || data.RefreshId.length < 10) {
                logAuthEvent('REFRESH_FAIL', {
                    reason: 'INVALID_REFRESH_RESPONSE',
                    response: data,
                });
                throw new Error('INVALID_REFRESH_RESPONSE');
            }

            logAuthEvent('REFRESH_SUCCESS', {
                newAccessToken: data.AccessId.slice(0, 25) + '...',
            });

            updateTokens(data.AccessId, data.RefreshId);
            refreshFailCount = 0;

            return data.AccessId;

        } catch (error: any) {
            const status = error?.response?.status;

            logAuthEvent('REFRESH_FAIL', {
                status,
                message: error?.message,
            });

            if (status === 400 || status === 401 || status === 403) {
                throw new Error('REFRESH_TOKEN_EXPIRED');
            }

            throw new Error('REFRESH_FAILED');
        }
    })();

    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

/* ───────── 9. Request interceptor ───────────────────────────────────────── */

api.interceptors.request.use((cfg) => {
    const token = getAccessToken();

    if (token) {
        if (!cfg.headers) {
            (cfg as any).headers = {};
        }
        (cfg.headers as any)['access-id'] = token;
    }

    logAuthEvent('REQUEST_SENT', {
        method: cfg.method?.toUpperCase(),
        url: cfg.url,
        hasAccessToken: !!token,
    });

    return cfg;
});

/* ───────── 10. Response interceptor с очередью retry ───────────────────── */

type QueueItem = {
    resolve: (token: string) => void;
    reject: (error: any) => void;
    url?: string;
};
let failedQueue: QueueItem[] = [];

function processQueue(error: any, token: string | null = null) {
    logAuthEvent('QUEUE_PROCESS', {
        queueLength: failedQueue.length,
        hasError: !!error,
        hasNewToken: !!token,
    });

    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else if (token) {
            resolve(token);
        }
    });
    failedQueue = [];
}

api.interceptors.response.use(
    (res: AxiosResponse) => {
        logAuthEvent('REQUEST_SUCCESS', {
            method: res.config.method?.toUpperCase(),
            url: res.config.url,
            status: res.status,
        });
        return res;
    },

    async (err: AxiosError) => {
        const { response, config } = err;

        if (response?.status === 401) {
            logAuthEvent('REQUEST_401', {
                method: config?.method?.toUpperCase(),
                url: config?.url,
                status: 401,
            });
        } else if (response) {
            logAuthEvent('REQUEST_ERROR', {
                method: config?.method?.toUpperCase(),
                url: config?.url,
                status: response.status,
            });
        }

        if (!response || response.status !== 401 || !config) {
            return Promise.reject(err);
        }

        const originalRequest = config as AxiosRequestConfig & {
            _retry?: boolean;
            _retryCount?: number;
        };

        const retryCount = originalRequest._retryCount ?? 0;
        if (retryCount >= 2) {
            console.error('[auth] Max retry count reached');
            handleSessionExpired('MAX_RETRY_COUNT_REACHED');
            return Promise.reject(err);
        }

        if (originalRequest._retry) {
            refreshFailCount++;
            console.error(`[auth] Retry failed (${refreshFailCount}/${MAX_REFRESH_FAILS})`);

            if (refreshFailCount >= MAX_REFRESH_FAILS) {
                console.error('[auth] Too many refresh failures');
                handleSessionExpired('TOO_MANY_REFRESH_FAILURES');
                return Promise.reject(err);
            }
        }

        originalRequest._retry = true;
        originalRequest._retryCount = retryCount + 1;

        if (refreshPromise) {
            logAuthEvent('QUEUE_ADD', {
                url: originalRequest.url,
                queueLength: failedQueue.length + 1,
            });

            return new Promise((resolve, reject) => {
                failedQueue.push({
                    resolve: (newToken: string) => {
                        if (originalRequest.headers) {
                            (originalRequest.headers as any)['access-id'] = newToken;
                        }
                        resolve(api(originalRequest));
                    },
                    reject,
                    url: originalRequest.url,
                });
            });
        }

        try {
            const newToken = await doRefresh();

            processQueue(null, newToken);

            logAuthEvent('RETRY_REQUEST', {
                method: originalRequest.method?.toUpperCase(),
                url: originalRequest.url,
            });

            if (originalRequest.headers) {
                (originalRequest.headers as any)['access-id'] = newToken;
            }

            return api(originalRequest);

        } catch (refreshError: any) {
            processQueue(refreshError, null);

            const errorType = refreshError?.message;

            const needsReauth =
                errorType === 'NO_REFRESH_TOKEN' ||
                errorType === 'REFRESH_TOKEN_EXPIRED' ||
                errorType === 'INVALID_REFRESH_RESPONSE';

            if (needsReauth) {
                handleSessionExpired(errorType);
            }

            return Promise.reject(refreshError);
        }
    }
);

/* ───────── 11. Exports ──────────────────────────────────────────────────── */

export { goToIdm as forceReauth };

export function hasValidTokens(): boolean {
    return !!memoryAccessToken && memoryAccessToken.length > 10;
}

export { handleSessionExpired };

/* ───────── 12. Debug ───────────────────────────────────────────────────── */

(window as any).__auth = {
    // Токены
    getAccessToken: () => memoryAccessToken,
    getRefreshToken: () => memoryRefreshToken,
    getCookieAccessToken: () => getCookie('accessToken'),
    getCookieRefreshToken: () => getCookie('refreshToken'),

    // Установка токенов (только dev)
    setDevToken: (token: string) => {
        if (isProdHost) {
            console.warn('[auth] Cannot set tokens on prod');
            return;
        }
        memoryAccessToken = token;
        syncTokensToCookie();
        console.log('[auth] Dev token set');
    },
    setDevTokens: (access: string, refresh: string) => {
        if (isProdHost) {
            console.warn('[auth] Cannot set tokens on prod');
            return;
        }
        updateTokens(access, refresh);
        console.log('[auth] Dev tokens set');
    },

    // Очистка
    clearTokens: () => {
        clearTokens();
    },

    // Состояние
    getQueueLength: () => failedQueue.length,
    isRefreshing: () => !!refreshPromise,

    // История событий
    getHistory: () => [...authHistory],
    getLastEvents: (n: number = 20) => authHistory.slice(-n),
    getAuthFlow: () => authHistory.filter(e =>
        ['REQUEST_401', 'REFRESH_START', 'REFRESH_SUCCESS', 'REFRESH_FAIL', 'RETRY_REQUEST', 'SESSION_EXPIRED'].includes(e.type)
    ),
    clearHistory: () => {
        authHistory.length = 0;
        eventCounter = 0;
        console.log('[auth] History cleared');
    },

    // Симуляция
    simulateExpired: () => handleSessionExpired('SIMULATED_EXPIRY'),

    // Полное состояние
    getState: () => ({
        memoryAccessToken: memoryAccessToken ? memoryAccessToken.slice(0, 30) + '...' : '(empty)',
        memoryRefreshToken: memoryRefreshToken ? memoryRefreshToken.slice(0, 30) + '...' : '(empty)',
        cookieAccessToken: getCookie('accessToken')?.slice(0, 30) + '...' || '(empty)',
        cookieRefreshToken: getCookie('refreshToken')?.slice(0, 30) + '...' || '(empty)',
        tokensMatch: {
            access: memoryAccessToken === (getCookie('accessToken') || ''),
            refresh: memoryRefreshToken === (getCookie('refreshToken') || ''),
        },
        isRefreshing: !!refreshPromise,
        queueLength: failedQueue.length,
        refreshFailCount,
        isProdHost,
        historyLength: authHistory.length,
    }),
};

console.log(
    '%c[auth] 🔧 Debug available: window.__auth',
    'color: #9C27B0; font-weight: bold'
);
