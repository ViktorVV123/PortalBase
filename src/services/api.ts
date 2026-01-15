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

const getCookie = (n: string): string | undefined =>
    decodeURIComponent(
        document.cookie.replace(
            new RegExp(
                '(?:(?:^|.*;)\\s*' +
                n.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&') +
                '\\s*=\\s*([^;]*).*$)|^.*$',
            ),
            '$1',
        ),
    ) || undefined;

const setCookie = (n: string, v: string, days = 1) => {
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${n}=${encodeURIComponent(v)}; expires=${exp}; path=/; SameSite=Strict`;
};

const deleteCookie = (n: string) => {
    document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;
};

/* ───────── 2. первые токены из ?ldapData=… ─────────────────────────────── */

(function readTokensFromUrl() {
    const search = new URLSearchParams(window.location.search);
    const encoded = search.get('ldapData');
    if (!encoded) return;

    try {
        const jsonStr = atob(decodeURIComponent(encoded));
        const j = JSON.parse(jsonStr);

        if (j.AccessId) setCookie('accessToken', j.AccessId);
        if (j.RefreshId) setCookie('refreshToken', j.RefreshId);

        search.delete('ldapData');
        const newQuery = search.toString();
        const newUrl =
            window.location.pathname +
            (newQuery ? `?${newQuery}` : '') +
            window.location.hash;
        window.history.replaceState({}, '', newUrl);
    } catch (e) {
        console.error('ldapData parse error:', e);
    }
})();

/* ───────── 3. токены: IN-MEMORY + cookie sync ────────────────────────────── */

// DEV токен для локальной разработки (на проде не используется)
const DEV_ACCESS_TOKEN = '';

// In-memory хранилище токенов — ГЛАВНЫЙ источник правды
let memoryAccessToken = getCookie('accessToken') ?? DEV_ACCESS_TOKEN;
let memoryRefreshToken = getCookie('refreshToken') ?? '';

// Синхронизируем in-memory → cookie
function syncTokensToCookie() {
    if (memoryAccessToken) {
        setCookie('accessToken', memoryAccessToken);
    }
    if (memoryRefreshToken) {
        setCookie('refreshToken', memoryRefreshToken);
    }
}

// Обновляем токены (вызывается после успешного refresh)
function updateTokens(access: string, refresh: string) {
    memoryAccessToken = access;
    memoryRefreshToken = refresh;
    syncTokensToCookie();
    console.log('[auth] Tokens updated in memory and cookie');
}

// Получить текущий access token (из памяти, не из cookie!)
function getAccessToken(): string {
    return memoryAccessToken;
}

/* ───────── 4. URL-ы API ────────────────────────────────────────────────── */

const API_URL = 'https://csc-fv.pro.lukoil.com/api';
const REFRESH_URL = `${API_URL}/refresh`;
const IDM_URL = 'https://csc-idm.pro.lukoil.com/?env=FrmV';

/* ───────── 5. редирект на IdM ─────────────────────────────────────────── */

const isProdHost = window.location.hostname === 'csc-fv.pro.lukoil.com';

let isRedirecting = false;

function goToIdm(): void {
    if (isRedirecting) {
        console.warn('[auth] Redirect already in progress');
        return;
    }
    isRedirecting = true;

    // Очищаем токены
    deleteCookie('accessToken');
    deleteCookie('refreshToken');
    memoryAccessToken = '';
    memoryRefreshToken = '';

    console.warn('[auth] Session expired. Redirecting to IdM...');

    // Показываем overlay
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

// ═══════════════════════════════════════════════════════════════════════════════
// НОВОЕ: Универсальная функция для обработки ситуации "сессия протухла"
// Работает и на проде, и в dev режиме
// ═══════════════════════════════════════════════════════════════════════════════
function handleSessionExpired(reason: string): void {
    console.error(`[auth] Session expired: ${reason}`);

    if (isProdHost) {
        // На проде — редирект на IdM
        goToIdm();
    } else {
        // В dev режиме — показываем сообщение и очищаем токены
        console.error('[auth] DEV MODE: Would redirect to IdM. Clear tokens and refresh page.');

        deleteCookie('accessToken');
        deleteCookie('refreshToken');
        memoryAccessToken = '';
        memoryRefreshToken = '';

        // Показываем overlay в dev режиме тоже
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

// Начальная проверка
if (!memoryAccessToken) {
    handleSessionExpired('NO_ACCESS_TOKEN_ON_START');
}

/* ───────── 6. Axios instance ─────────────────────────────────────────────── */

export const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

/* ───────── 7. Refresh logic с защитой от race condition ─────────────────── */

// Единый промис на refresh — все ждут его завершения
let refreshPromise: Promise<string> | null = null;

// Счётчик неудачных попыток refresh подряд
let refreshFailCount = 0;
const MAX_REFRESH_FAILS = 2;

/**
 * Выполняет refresh и возвращает НОВЫЙ accessToken.
 * Все параллельные вызовы получат один и тот же результат.
 */
async function doRefresh(): Promise<string> {
    // Если refresh уже идёт — ждём его результат
    if (refreshPromise) {
        console.log('[auth] Waiting for existing refresh...');
        return refreshPromise;
    }

    // Создаём новый refresh
    refreshPromise = (async () => {
        const currentRefresh = memoryRefreshToken;

        // ═══════════════════════════════════════════════════════════════════
        // ИСПРАВЛЕНО: Если нет refresh token — сразу сессия протухла
        // ═══════════════════════════════════════════════════════════════════
        if (!currentRefresh) {
            console.error('[auth] No refresh token available');
            throw new Error('NO_REFRESH_TOKEN');
        }

        console.log('[auth] Starting token refresh...');

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

            if (!data.AccessId || !data.RefreshId) {
                console.error('[auth] Invalid refresh response:', data);
                throw new Error('INVALID_REFRESH_RESPONSE');
            }

            // Обновляем токены в памяти И в cookie
            updateTokens(data.AccessId, data.RefreshId);

            // Сбрасываем счётчик неудач
            refreshFailCount = 0;

            console.log('[auth] Token refresh successful');
            return data.AccessId;

        } catch (error: any) {
            const status = error?.response?.status;

            console.error('[auth] Refresh failed:', {
                status,
                message: error?.message,
                data: error?.response?.data,
            });

            // ═══════════════════════════════════════════════════════════════════
            // ИСПРАВЛЕНО: Любая ошибка refresh = refresh token протух
            // 401, 403, 500, network error — всё означает что нужна переавторизация
            // ═══════════════════════════════════════════════════════════════════
            if (status === 401 || status === 403) {
                throw new Error('REFRESH_TOKEN_EXPIRED');
            }

            // Для других ошибок (500, timeout, network) — тоже считаем что нужен reauth
            // после MAX_REFRESH_FAILS попыток
            throw new Error('REFRESH_FAILED');

        }
    })();

    try {
        return await refreshPromise;
    } finally {
        // Очищаем промис после завершения (успех или ошибка)
        refreshPromise = null;
    }
}

/* ───────── 8. Request interceptor ───────────────────────────────────────── */

api.interceptors.request.use((cfg) => {
    // Берём токен из ПАМЯТИ (не из cookie!) — это гарантирует актуальность
    const token = getAccessToken();

    if (token) {
        if (!cfg.headers) {
            (cfg as any).headers = {};
        }
        (cfg.headers as any)['access-id'] = token;
    }

    return cfg;
});

/* ───────── 9. Response interceptor с очередью retry ───────────────────── */

// Очередь запросов, ожидающих refresh
type QueueItem = {
    resolve: (token: string) => void;
    reject: (error: any) => void;
};
let failedQueue: QueueItem[] = [];

function processQueue(error: any, token: string | null = null) {
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
    (res: AxiosResponse) => res,

    async (err: AxiosError) => {
        const { response, config } = err;

        // Не 401 или нет конфига — просто пробрасываем
        if (!response || response.status !== 401 || !config) {
            return Promise.reject(err);
        }

        const originalRequest = config as AxiosRequestConfig & {
            _retry?: boolean;
            _retryCount?: number;
        };

        // Защита от бесконечного retry
        const retryCount = originalRequest._retryCount ?? 0;
        if (retryCount >= 2) {
            console.error('[auth] Max retry count reached');
            handleSessionExpired('MAX_RETRY_COUNT_REACHED');
            return Promise.reject(err);
        }

        // Если это уже retry после refresh — значит новый токен тоже не работает
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

        // Если refresh уже идёт — встаём в очередь
        if (refreshPromise) {
            console.log('[auth] Request queued, waiting for refresh...');

            return new Promise((resolve, reject) => {
                failedQueue.push({
                    resolve: (newToken: string) => {
                        // Обновляем токен в запросе и повторяем
                        if (originalRequest.headers) {
                            (originalRequest.headers as any)['access-id'] = newToken;
                        }
                        resolve(api(originalRequest));
                    },
                    reject,
                });
            });
        }

        // Запускаем refresh
        try {
            const newToken = await doRefresh();

            // Обрабатываем очередь ожидающих запросов
            processQueue(null, newToken);

            // Обновляем токен в текущем запросе
            if (originalRequest.headers) {
                (originalRequest.headers as any)['access-id'] = newToken;
            }

            // Повторяем запрос
            return api(originalRequest);

        } catch (refreshError: any) {
            // Обрабатываем очередь с ошибкой
            processQueue(refreshError, null);

            const errorType = refreshError?.message;

            // ═══════════════════════════════════════════════════════════════════
            // ИСПРАВЛЕНО: Все ошибки refresh приводят к handleSessionExpired
            // ═══════════════════════════════════════════════════════════════════
            const needsReauth =
                errorType === 'NO_REFRESH_TOKEN' ||
                errorType === 'REFRESH_TOKEN_EXPIRED' ||
                errorType === 'INVALID_REFRESH_RESPONSE' ||
                errorType === 'REFRESH_FAILED';

            if (needsReauth) {
                handleSessionExpired(errorType);
            }

            return Promise.reject(refreshError);
        }
    }
);

/* ───────── 10. Exports ──────────────────────────────────────────────────── */

export { goToIdm as forceReauth };

export function hasValidTokens(): boolean {
    return !!memoryAccessToken;
}

// Экспортируем для использования в других местах
export { handleSessionExpired };

/* ───────── 11. Debug (только для разработки) ───────────────────────────── */

if (!isProdHost) {
    (window as any).__auth = {
        getAccessToken: () => memoryAccessToken,
        getRefreshToken: () => memoryRefreshToken,
        setDevToken: (token: string) => {
            memoryAccessToken = token;
            syncTokensToCookie();
            console.log('[auth] Dev token set');
        },
        setDevTokens: (access: string, refresh: string) => {
            updateTokens(access, refresh);
            console.log('[auth] Dev tokens set');
        },
        clearTokens: () => {
            deleteCookie('accessToken');
            deleteCookie('refreshToken');
            memoryAccessToken = '';
            memoryRefreshToken = '';
            console.log('[auth] Tokens cleared');
        },
        getQueueLength: () => failedQueue.length,
        isRefreshing: () => !!refreshPromise,
        simulateExpired: () => handleSessionExpired('SIMULATED_EXPIRY'),
    };

    console.log('[auth] Debug available: window.__auth');
    console.log('[auth] Commands: getAccessToken(), getRefreshToken(), setDevToken(t), setDevTokens(a,r), clearTokens(), simulateExpired()');
}