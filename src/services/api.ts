// --- src/api.ts --------------------------------------------------------------
// авторизация: AccessId / RefreshId в cookies + «тихий» refresh через POST /refresh

import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosError,
    AxiosResponse,
} from 'axios';

/* ───────── 1. helpers: cookie read / write ──────────────────────────────── */

/// Функция чтения cookie по имени
const getCookie = (n: string): string | undefined =>
    decodeURIComponent(
        // Ищем значение cookie с именем n через регулярку
        document.cookie.replace(
            new RegExp(
                '(?:(?:^|.*;)\\s*' +
                n.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&') +
                '\\s*=\\s*([^;]*).*$)|^.*$',
            ),
            '$1',
        ),
    ) || undefined;

/// Функция записи cookie с временем жизни в днях
const setCookie = (n: string, v: string, days = 1) => {
    // Дата истечения cookie
    const exp = new Date(Date.now() + days * 864e5).toUTCString();
    // Записываем cookie: имя, значение (url-encoded), срок, путь, SameSite
    document.cookie = `${n}=${encodeURIComponent(
        v,
    )}; expires=${exp}; path=/; SameSite=Strict`;
};

/* ───────── 2. первые токены из ?ldapData=… ─────────────────────────────── */

/// Немедленно вызываемая функция для разбора параметра ldapData из URL
(function readTokensFromUrl() {
    // Берём все query-параметры из текущего URL
    const search = new URLSearchParams(window.location.search);
    // Пытаемся прочитать параметр ldapData
    const encoded = search.get('ldapData');
    // Если параметра нет — просто выходим
    if (!encoded) return;

    try {
        // ldapData приходит URL-encoded + base64, поэтому сначала decodeURIComponent
        const jsonStr = atob(decodeURIComponent(encoded));
        // Парсим JSON с AccessId / RefreshId
        const j = JSON.parse(jsonStr);

        // Если есть AccessId — сохраняем как accessToken в cookie
        if (j.AccessId) setCookie('accessToken', j.AccessId);
        // Если есть RefreshId — сохраняем как refreshToken в cookie
        if (j.RefreshId) setCookie('refreshToken', j.RefreshId);

        // После успешного чтения токенов удаляем ldapData из URL,
        // чтобы токены не торчали в истории / скринах / логах
        search.delete('ldapData');
        const newQuery = search.toString();
        const newUrl =
            window.location.pathname +
            (newQuery ? `?${newQuery}` : '') +
            window.location.hash;
        // Обновляем адресную строку без перезагрузки страницы
        window.history.replaceState({}, '', newUrl);
    } catch (e) {
        // Если что-то пошло не так при decode/base64/JSON — просто логируем
        console.error('ldapData parse error:', e);
    }
})();

/* ───────── 3. токены из cookie + локальные переменные -------------------- */

/// Читаем AccessId из cookie (если нет — подставляем пустую строку)
let accessToken = getCookie('accessToken') ?? '8f86bf66-84a4-4a70-8bee-a394047dee7a';
/// Читаем RefreshId из cookie
let refreshToken = getCookie('refreshToken') ?? '';

/* ───────── 4. URL-ы API и POST /refresh ────────────────────────────────── */

/// Базовый URL API (при желании можно завести через env-переменные)
const API_URL = 'https://csc-fv.pro.lukoil.com/api';

/// URL эндпоинта тихого обновления токенов
const REFRESH_URL = `${API_URL}/refresh`;

/* ───────── 5. крайний случай – редирект на IdM ---------------------------- */

/// Функция, которая отправляет пользователя на IdM для переавторизации
function goToIdm(): void {
    // Пробуем достать RefreshId из cookie
    const r = getCookie('refreshToken');
    // Базовый адрес IdM с параметром env
    const base = 'https://csc-idm.pro.lukoil.com/?env=FrmV';
    // Если RefreshId есть — добавляем его в query-параметр RefreshId
    const url = r ? `${base}&RefreshId=${encodeURIComponent(r)}` : base;
    // Жёсткий редирект браузера
    window.location.href = url;
}

/// Определяем, что мы на боевом домене (где нужен жёсткий редирект)
const isProdHost = window.location.hostname === 'csc-fv.pro.lukoil.com';

/// Если нет accessToken:
///  - на PROD → сразу отправляем на IdM
///  - на localhost/dev → только предупреждаем в консоль, редирект не делаем,
///    чтобы можно было руками подставлять токены и тестировать
if (!accessToken) {
    if (isProdHost) {
        goToIdm();
    } else {
        console.warn(
            '[auth] Нет accessToken, но хост не PROD – редирект в IdM отключён (режим разработки)',
        );
    }
}

/* ───────── 6. Axios instance + interceptors ─────────────────────────────── */

/// Создаём единый экземпляр axios для всего приложения
export const api: AxiosInstance = axios.create({
    baseURL: API_URL, // базовый URL для всех запросов
    headers: { 'Content-Type': 'application/json' }, // дефолтный заголовок
});

let refreshPromise: Promise<void> | null = null;

async function runRefreshOnce(): Promise<void> {
    const liveRefresh = getCookie('refreshToken');

    if (!liveRefresh) {
        throw new Error('no refresh token');
    }

    const { data } = await axios.post<{
        AccessId: string;
        RefreshId: string;
    }>(
        REFRESH_URL,
        undefined,
        {
            params: { refresh_id: liveRefresh },
            headers: { accept: 'application/json' },
        },
    );

    // сохраняем новую пару
    setCookie('accessToken', data.AccessId);
    setCookie('refreshToken', data.RefreshId);

    accessToken = data.AccessId;
    refreshToken = data.RefreshId;
}




/* --- request: auth-заголовок --------------------------------------------- */

/// Интерцептор запросов: перед каждым запросом подставляем актуальный accessToken
api.interceptors.request.use((cfg) => {
    const fresh = getCookie('accessToken') ?? accessToken;

    if (fresh) {
        if (!cfg.headers) {
            (cfg as any).headers = {};
        }
        (cfg.headers as any)['access-id'] = fresh;
    }

    return cfg;
});

/* --- response: 401 → POST /refresh → retry ------------------------------- */

/// Интерцептор ответов: если получили 401, пробуем тихо обновить токены через /refresh
api.interceptors.response.use(
    (res: AxiosResponse) => res,

    async (err: AxiosError) => {
        const { response, config } = err;

        if (!response || response.status !== 401 || !config) {
            return Promise.reject(err);
        }

        const cfg = config as AxiosRequestConfig & { _retry?: boolean };

        // если уже пробовали ретраить этот запрос — идём в IdM
        if (cfg._retry) {
            goToIdm();
            return Promise.reject(err);
        }

        cfg._retry = true;

        // если refresh ещё не запущен — запускаем
        if (!refreshPromise) {
            refreshPromise = (async () => {
                try {
                    await runRefreshOnce();
                } finally {
                    // обязательно очищаем, чтобы следующие 401 могли заново дернуть refresh
                    refreshPromise = null;
                }
            })();
        }

        try {
            // ждём, пока ОДИН общий refresh выполнится
            await refreshPromise;
            // и повторяем исходный запрос — интерцептор подставит новый accessToken
            return api(cfg);
        } catch (refreshErr) {
            console.error('silent refresh failed:', refreshErr);
            goToIdm();
            return Promise.reject(refreshErr);
        }
    },
);