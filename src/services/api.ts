// --- src/api.ts --------------------------------------------------------------
// авторизация: AccessId / RefreshId в cookies + «тихий» refresh через POST /refresh_session

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
    document.cookie = `${n}=${encodeURIComponent(
        v,
    )}; expires=${exp}; path=/; SameSite=Strict`;
};

/* ───────── 2. первые токены из ?ldapData=… ─────────────────────────────── */

(function readTokensFromUrl() {
    const encoded = new URLSearchParams(window.location.search).get('ldapData');
    if (!encoded) return;

    try {
        const j = JSON.parse(atob(decodeURIComponent(encoded)));
        if (j.AccessId) setCookie('accessToken', j.AccessId);
        if (j.RefreshId) setCookie('refreshToken', j.RefreshId);
    } catch (e) {
        console.error('ldapData parse error:', e);
    }
})();

/* ───────── 3. токены из cookie, fallback для localhost ─────────────────── */

let accessToken = getCookie('accessToken') ?? '';
let refreshToken = getCookie('refreshToken') ?? '';

const isLocalhost = window.location.hostname === 'localhost';
if (isLocalhost && !accessToken) {
    accessToken = 'local-demo-access-token';
    refreshToken = 'local-demo-refresh-token';
    setCookie('accessToken', accessToken);
    setCookie('refreshToken', refreshToken);
}

/* ───────── 4. URL-ы API и POST /refresh_session ────────────────────────── */

const API_URL = isLocalhost
    ? 'https://csc-fv.pro.lukoil.com/api'
    : 'https://csc-fv.pro.lukoil.com/api';

const REFRESH_URL = `${API_URL}/refresh`;

/* ───────── 5. крайний случай – редирект на IdM ---------------------------- */

function goToIdm(): void {
    const r = getCookie('refreshToken');
    const base = 'https://csc-idm.pro.lukoil.com/?env=FrmV';
    const url = r ? `${base}&RefreshId=${encodeURIComponent(r)}` : base;
    window.location.href = url;
}

if (!isLocalhost && !accessToken) goToIdm(); // старт без AccessId

/* ───────── 6. Axios instance + interceptors ─────────────────────────────── */

export const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json','access-id': '4af1cdd7-9534-4e23-a5d2-5a0843c0d55a' },
});

/*'access-id': 'eef86f09-3cd3-45df-8269-089c9aad1b6b'*/
/* --- request: auth-заголовок --------------------------------------------- */

// @ts-ignore
api.interceptors.request.use((cfg: AxiosRequestConfig) => {
    const fresh = getCookie('accessToken') ?? accessToken;
    if (fresh) cfg.headers = { ...cfg.headers, auth: fresh };
    return cfg;
});

/* --- response: 401 → POST /refresh_session → retry ----------------------- */

api.interceptors.response.use(
    (res: AxiosResponse) => res,
    async (err: AxiosError) => {
        const { response, config } = err;
        if (!response || response.status !== 401) return Promise.reject(err);

        /* dev-режим: просто логируем */
        if (isLocalhost) {
            console.warn('[Auth] localhost → 401 (demo token)');
            return Promise.reject(err);
        }

        /* избегаем бесконечной петли (retry только один раз) */
        // @ts-ignore
        if ((config as any)._retry) {
            goToIdm();
            return;
        }
        // @ts-ignore
        (config as any)._retry = true;

        const liveRefresh = getCookie('refreshToken');
        if (!liveRefresh) {
            goToIdm();
            return;
        }

        try {
            /* 🔄 тихий refresh: POST /refresh_session
               – body  : { "token": "<RefreshId>" }
               – header: auth: <RefreshId>
            */
            const { data } = await axios.post<{
                AccessId: string;
                RefreshId: string;
            }>(
                REFRESH_URL,
                { token: liveRefresh },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        auth: liveRefresh,
                    },
                },
            );

            /* сохраняем новую пару в cookie и память */
            setCookie('accessToken', data.AccessId);
            setCookie('refreshToken', data.RefreshId);
            accessToken = data.AccessId;
            refreshToken = data.RefreshId;

            /* повторяем оригинальный запрос: request-интерцептор вставит новый AccessId */
            return api(config);
        } catch (refreshErr) {
            console.error('silent refresh failed:', refreshErr);
            goToIdm(); // fallback – полная переавторизация
            return;
        }
    },
);
