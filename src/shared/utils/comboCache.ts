// src/shared/utils/comboCache.ts
// Улучшенный кэш для combobox опций с LRU, TTL и опциональным localStorage

export type ComboOption = {
    id: string;
    show: string[];
    showHidden: string[];
};

type ComboColumnMeta = {
    ref_column_order: number;
    width: number;
    combobox_alias: string | null;
};

type CacheEntry = {
    options: ComboOption[];
    columns: ComboColumnMeta[];
    timestamp: number;
};

type ComboCacheConfig = {
    /** Максимальное количество записей в кэше (LRU) */
    maxSize: number;
    /** Время жизни записи в миллисекундах (по умолчанию 5 минут) */
    ttl: number;
    /** Использовать localStorage для персистентности */
    useLocalStorage: boolean;
    /** Ключ для localStorage */
    storageKey: string;
};

const DEFAULT_CONFIG: ComboCacheConfig = {
    maxSize: 100,
    ttl: 5 * 60 * 1000, // 5 минут
    useLocalStorage: true,
    storageKey: 'combo_cache_v1',
};

class ComboCache {
    private cache: Map<string, CacheEntry>;
    private accessOrder: string[]; // Для LRU — последние использованные в конце
    private config: ComboCacheConfig;

    constructor(config: Partial<ComboCacheConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cache = new Map();
        this.accessOrder = [];

        // Загружаем из localStorage при инициализации
        if (this.config.useLocalStorage) {
            this.loadFromStorage();
        }
    }

    /** Генерация ключа кэша */
    makeKey(widgetColumnId: number, writeTcId: number): string {
        return `${widgetColumnId}:${writeTcId}`;
    }

    /** Получить из кэша (с проверкой TTL) */
    get(key: string): CacheEntry | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Проверяем TTL
        if (Date.now() - entry.timestamp > this.config.ttl) {
            this.delete(key);
            return null;
        }

        // Обновляем порядок доступа (LRU)
        this.touchAccessOrder(key);

        return entry;
    }

    /** Получить только options */
    getOptions(widgetColumnId: number, writeTcId: number): ComboOption[] | null {
        const key = this.makeKey(widgetColumnId, writeTcId);
        const entry = this.get(key);
        return entry?.options ?? null;
    }

    /** Сохранить в кэш */
    set(key: string, options: ComboOption[], columns: ComboColumnMeta[]): void {
        // Если достигли лимита — удаляем самый старый (LRU)
        if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }

        const entry: CacheEntry = {
            options,
            columns,
            timestamp: Date.now(),
        };

        this.cache.set(key, entry);
        this.touchAccessOrder(key);

        // Сохраняем в localStorage
        if (this.config.useLocalStorage) {
            this.saveToStorage();
        }
    }

    /** Удалить из кэша */
    delete(key: string): void {
        this.cache.delete(key);
        this.accessOrder = this.accessOrder.filter(k => k !== key);

        if (this.config.useLocalStorage) {
            this.saveToStorage();
        }
    }

    /** Очистить весь кэш */
    clear(): void {
        this.cache.clear();
        this.accessOrder = [];

        if (this.config.useLocalStorage) {
            try {
                localStorage.removeItem(this.config.storageKey);
            } catch {
                // localStorage недоступен
            }
        }
    }

    /** Очистить устаревшие записи */
    cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        this.cache.forEach((entry, key) => {
            if (now - entry.timestamp > this.config.ttl) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.delete(key));
    }

    /** Получить статистику кэша */
    getStats(): { size: number; maxSize: number; keys: string[] } {
        return {
            size: this.cache.size,
            maxSize: this.config.maxSize,
            keys: Array.from(this.cache.keys()),
        };
    }

    /** Проверить есть ли в кэше (без обновления TTL) */
    has(widgetColumnId: number, writeTcId: number): boolean {
        const key = this.makeKey(widgetColumnId, writeTcId);
        const entry = this.cache.get(key);

        if (!entry) return false;

        // Проверяем TTL
        if (Date.now() - entry.timestamp > this.config.ttl) {
            this.delete(key);
            return false;
        }

        return true;
    }

    /** Инвалидировать конкретный combobox (после CRUD в связанной таблице) */
    invalidate(widgetColumnId: number, writeTcId: number): void {
        const key = this.makeKey(widgetColumnId, writeTcId);
        this.delete(key);
    }

    /** Инвалидировать все combobox для widgetColumnId */
    invalidateByWidget(widgetColumnId: number): void {
        const prefix = `${widgetColumnId}:`;
        const keysToDelete = Array.from(this.cache.keys()).filter(k => k.startsWith(prefix));
        keysToDelete.forEach(key => this.delete(key));
    }

    // ═══════════════════════════════════════════════════════════
    // Private методы
    // ═══════════════════════════════════════════════════════════

    private touchAccessOrder(key: string): void {
        // Удаляем из текущей позиции
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        // Добавляем в конец (самые новые в конце)
        this.accessOrder.push(key);
    }

    private evictOldest(): void {
        // Удаляем самый давно использованный (первый в массиве)
        const oldest = this.accessOrder.shift();
        if (oldest) {
            this.cache.delete(oldest);
        }
    }

    private saveToStorage(): void {
        try {
            const data: Record<string, CacheEntry> = {};
            this.cache.forEach((entry, key) => {
                data[key] = entry;
            });

            localStorage.setItem(this.config.storageKey, JSON.stringify({
                data,
                accessOrder: this.accessOrder,
            }));
        } catch {
            // localStorage недоступен или переполнен — игнорируем
        }
    }

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(this.config.storageKey);
            if (!raw) return;

            const parsed = JSON.parse(raw);
            const now = Date.now();

            // Загружаем только невалидированные записи
            if (parsed.data && typeof parsed.data === 'object') {
                Object.entries(parsed.data).forEach(([key, entry]) => {
                    const e = entry as CacheEntry;
                    // Проверяем TTL при загрузке
                    if (now - e.timestamp <= this.config.ttl) {
                        this.cache.set(key, e);
                    }
                });
            }

            // Восстанавливаем порядок доступа (только для существующих ключей)
            if (Array.isArray(parsed.accessOrder)) {
                this.accessOrder = parsed.accessOrder.filter((k: string) => this.cache.has(k));
            }
        } catch {
            // Ошибка парсинга — очищаем storage
            try {
                localStorage.removeItem(this.config.storageKey);
            } catch {
                // ignore
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Singleton экземпляр
// ═══════════════════════════════════════════════════════════

export const comboCache = new ComboCache({
    maxSize: 100,           // Максимум 100 разных combobox
    ttl: 5 * 60 * 1000,     // 5 минут
    useLocalStorage: true,  // Сохранять между перезагрузками
});

// ═══════════════════════════════════════════════════════════
// Утилиты для удобства
// ═══════════════════════════════════════════════════════════

/** Очистить кэш для конкретного combobox */
export function invalidateCombo(widgetColumnId: number, writeTcId: number): void {
    comboCache.invalidate(widgetColumnId, writeTcId);
}

/** Очистить весь кэш */
export function clearAllComboCache(): void {
    comboCache.clear();
}

/** Очистить устаревшие записи (можно вызывать периодически) */
export function cleanupComboCache(): void {
    comboCache.cleanup();
}