// src/components/Form/treeForm/TreeFormTable.tsx

import React, {useState, useCallback, useEffect} from 'react';
import * as s from './TreeFormTable.module.scss';
import SortIcon from '@/assets/image/SortIcon.svg';
import {FormTreeColumn} from '@/shared/hooks/useWorkSpaces';
import {api} from '@/services/api';

// ─────────────────────────────────────────────────────────────
// ТИПЫ
// ─────────────────────────────────────────────────────────────

type TreeFormTableProps = {
    tree: FormTreeColumn[] | null;
    selectedFormId: number | null;
    handleTreeValueClick: (table_column_id: number, value: string | number) => void;
    handleNestedValueClick: (table_column_id: number, value: string | number) => void;

    onFilterMain?: (filters: Array<{ table_column_id: number; value: string | number }>) => Promise<void>;
    expandedKeys: Set<string>;
    setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    childrenCache: Record<string, FormTreeColumn[]>;
    setChildrenCache: React.Dispatch<React.SetStateAction<Record<string, FormTreeColumn[]>>>;
    onResetFilters?: () => Promise<void>;
};

type SortMode = 'asc' | 'desc';

type Filter = { table_column_id: number; value: string | number };

type ValuePair = {
    value: string | number;
    displayValue: string | number;
};

// ─────────────────────────────────────────────────────────────
// УТИЛИТЫ
// ─────────────────────────────────────────────────────────────

const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

function sortValuePairs(pairs: ValuePair[], mode: SortMode): ValuePair[] {
    const dir = mode === 'asc' ? 1 : -1;
    return [...pairs].sort((a, b) =>
        collator.compare(String(a.displayValue), String(b.displayValue)) * dir
    );
}

function getValuePairs(treeColumn: FormTreeColumn): ValuePair[] {
    const values = treeColumn.values ?? [];
    const displayValues = (treeColumn as any).display_values ?? values;

    const pairs: ValuePair[] = [];

    for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (val == null) continue;

        pairs.push({
            value: val as string | number,
            displayValue: (displayValues[i] ?? val) as string | number,
        });
    }

    return pairs;
}

function isGuidLike(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function shouldAutoExpand(treeColumn: FormTreeColumn): boolean {
    const values = (treeColumn.values ?? []).filter((v) => v != null);
    const displayValues = ((treeColumn as any).display_values ?? []).filter((v: any) => v != null);

    if (values.length !== 1) return false;

    const val = values[0];
    const displayVal = displayValues[0] ?? val;

    return isGuidLike(val) && val === displayVal;
}

/**
 * Ключ кэша = полный путь фильтров
 */
function makeCacheKey(filters: Filter[]): string {
    return filters.map(f => `${f.table_column_id}:${f.value}`).join('|');
}

/**
 * Ключ раскрытия = ТОЖЕ полный путь!
 * Это гарантирует что 2021→Marine и 2022→Marine — разные ключи
 */
function makeExpandKey(filters: Filter[]): string {
    return filters.map(f => `${f.table_column_id}:${f.value}`).join('|');
}

// ─────────────────────────────────────────────────────────────
// ОСНОВНОЙ КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────

export const TreeFormTable: React.FC<TreeFormTableProps> = ({
                                                                tree,
                                                                selectedFormId,
                                                                handleTreeValueClick,
                                                                handleNestedValueClick,
                                                                onFilterMain,
                                                                expandedKeys,
                                                                setExpandedKeys,
                                                                childrenCache,
                                                                setChildrenCache,
                                                                onResetFilters,
                                                            }) => {
    const [sortModes, setSortModes] = useState<Record<number, SortMode>>({});
    const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

    useEffect(() => {
        setExpandedKeys(new Set());
        setChildrenCache({});
        setSortModes({});
        setLoadingKeys(new Set());
    }, [selectedFormId]);

    const toggleSort = useCallback((idx: number) => {
        setSortModes((prev) => ({
            ...prev,
            [idx]: (prev[idx] ?? 'asc') === 'asc' ? 'desc' : 'asc',
        }));
    }, []);

    // ═══════════════════════════════════════════════════════════
    // РЕКУРСИВНАЯ ЗАГРУЗКА
    // ═══════════════════════════════════════════════════════════

    const loadAndExpandRecursively = useCallback(async (
        table_column_id: number,
        value: string | number,
        parentFilters: Filter[],
        currentCache: Record<string, FormTreeColumn[]>
    ): Promise<{
        keysToExpand: string[];
        newCache: Record<string, FormTreeColumn[]>;
        finalFilters: Filter[];
    }> => {
        if (!selectedFormId) {
            return {keysToExpand: [], newCache: currentCache, finalFilters: parentFilters};
        }

        const filters = [...parentFilters, {table_column_id, value}];
        const cacheKey = makeCacheKey(filters);
        const expandKey = makeExpandKey(filters);  // ← Полный путь!
        const keysToExpand: string[] = [expandKey];
        let newCache = {...currentCache};

        let children = currentCache[cacheKey];
        if (!children) {
            try {
                const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(
                    `/display/${selectedFormId}/tree`,
                    filters.map((f) => ({...f, value: String(f.value)}))
                );
                children = Array.isArray(data) ? data : [data];
                newCache = {...newCache, [cacheKey]: children};
            } catch (e) {
                console.warn('[TreeFormTable] Failed to load:', cacheKey, e);
                return {keysToExpand, newCache, finalFilters: filters};
            }
        }

        if (!children || children.length === 0) {
            return {keysToExpand, newCache, finalFilters: filters};
        }

        let finalFilters = filters;

        for (const child of children) {
            if (shouldAutoExpand(child)) {
                const childValue = child.values.filter((v) => v != null)[0];
                if (childValue != null) {
                    const result = await loadAndExpandRecursively(
                        child.table_column_id,
                        childValue as string | number,
                        filters,
                        newCache
                    );

                    keysToExpand.push(...result.keysToExpand);
                    newCache = result.newCache;
                    finalFilters = result.finalFilters;
                }
            }
        }

        return {keysToExpand, newCache, finalFilters};
    }, [selectedFormId]);

    // ═══════════════════════════════════════════════════════════
    // КЛИК ПО УЗЛУ
    // ═══════════════════════════════════════════════════════════

    const handleNodeClick = useCallback(async (
        table_column_id: number,
        value: string | number,
        parentFilters: Filter[]
    ) => {
        const filters = [...parentFilters, {table_column_id, value}];
        const expandKey = makeExpandKey(filters);
        const cacheKey = makeCacheKey(filters);

        // ═══════════════════════════════════════════════════════════
        // ЕСЛИ УЖЕ РАСКРЫТ — СВОРАЧИВАЕМ
        // ═══════════════════════════════════════════════════════════

        if (expandedKeys.has(expandKey)) {
            // Удаляем этот ключ и все дочерние (по префиксу)
            const prefix = expandKey + '|';

            setExpandedKeys((prev) => {
                const next = new Set<string>();
                prev.forEach((k) => {
                    // Оставляем только те, которые НЕ начинаются с нашего пути
                    if (k !== expandKey && !k.startsWith(prefix)) {
                        next.add(k);
                    }
                });
                return next;
            });

            // Применяем фильтры родительского уровня
            if (parentFilters.length === 0) {
                if (onResetFilters) {
                    await onResetFilters();
                } else if (onFilterMain) {
                    await onFilterMain([]);
                }
            } else if (onFilterMain) {
                await onFilterMain(parentFilters);
            } else if (parentFilters.length === 1) {
                handleTreeValueClick(parentFilters[0].table_column_id, parentFilters[0].value);
            } else {
                const last = parentFilters[parentFilters.length - 1];
                handleNestedValueClick(last.table_column_id, last.value);
            }

            return;
        }

        // ═══════════════════════════════════════════════════════════
        // РАСКРЫВАЕМ НОВЫЙ УЗЕЛ
        // ═══════════════════════════════════════════════════════════

        // Находим "братьев" — узлы с тем же родителем но другим значением на этом уровне
        const parentPrefix = parentFilters.length > 0
            ? makeExpandKey(parentFilters) + '|' + table_column_id + ':'
            : table_column_id + ':';

        setLoadingKeys((prev) => {
            const next = new Set(prev);
            next.add(expandKey);
            return next;
        });

        try {
            const {keysToExpand, newCache, finalFilters} = await loadAndExpandRecursively(
                table_column_id,
                value,
                parentFilters,
                childrenCache
            );

            setChildrenCache(newCache);

            setExpandedKeys((prev) => {
                const next = new Set<string>();

                // Проходим по всем текущим ключам
                prev.forEach((k) => {
                    // Проверяем, является ли это "братом" (тот же уровень, другое значение)
                    // Братья начинаются с того же parentPrefix
                    if (k.startsWith(parentPrefix) && !k.startsWith(expandKey)) {
                        // Это брат или его потомок — не добавляем
                        return;
                    }
                    // Проверяем, является ли это потомком брата
                    // Потомки братьев тоже не добавляем
                    const kParts = k.split('|');
                    const parentParts = parentFilters.map(f => `${f.table_column_id}:${f.value}`);

                    // Если путь совпадает до родителя, но расходится на текущем уровне
                    if (parentParts.length < kParts.length) {
                        const kParentPath = kParts.slice(0, parentParts.length).join('|');
                        const ourParentPath = parentParts.join('|');

                        if (kParentPath === ourParentPath) {
                            // Это на том же уровне или ниже
                            const levelKey = kParts[parentParts.length];
                            const ourLevelKey = `${table_column_id}:${value}`;

                            if (levelKey !== ourLevelKey) {
                                // Это брат или потомок брата — не добавляем
                                return;
                            }
                        }
                    }

                    next.add(k);
                });

                // Добавляем новые ключи
                keysToExpand.forEach((k) => next.add(k));

                return next;
            });

            if (onFilterMain) {
                await onFilterMain(finalFilters);
            } else if (finalFilters.length === 1) {
                handleTreeValueClick(finalFilters[0].table_column_id, finalFilters[0].value);
            } else if (finalFilters.length > 1) {
                const last = finalFilters[finalFilters.length - 1];
                handleNestedValueClick(last.table_column_id, last.value);
            }
        } catch (e) {
            console.warn('[TreeFormTable] handleNodeClick error:', e);
        } finally {
            setLoadingKeys((prev) => {
                const next = new Set(prev);
                next.delete(expandKey);
                return next;
            });
        }
    }, [
        expandedKeys,
        childrenCache,
        loadAndExpandRecursively,
        onFilterMain,
        onResetFilters,
        handleTreeValueClick,
        handleNestedValueClick,
        setExpandedKeys,
        setChildrenCache,
    ]);

    // ═══════════════════════════════════════════════════════════
    // РЕНДЕР УЗЛА
    // ═══════════════════════════════════════════════════════════

    const renderNode = useCallback((
        treeColumn: FormTreeColumn,
        parentFilters: Filter[],
        depth: number,
        sortMode: SortMode
    ): React.ReactNode => {
        const {name, table_column_id} = treeColumn;
        const pairs = getValuePairs(treeColumn);
        const sortedPairs = sortValuePairs(pairs, sortMode);
        const isAutoExpandNode = shouldAutoExpand(treeColumn);

        if (isAutoExpandNode) {
            const guidValue = pairs[0]?.value;
            if (guidValue == null) return null;

            const filters = [...parentFilters, {table_column_id, value: guidValue}];
            const expandKey = makeExpandKey(filters);
            const cacheKey = makeCacheKey(filters);
            const children = childrenCache[cacheKey] ?? [];
            const isExpanded = expandedKeys.has(expandKey);

            if (isExpanded && children.length > 0) {
                return (
                    <React.Fragment key={`auto-${expandKey}`}>
                        {children.map((childCol, j) => (
                            <React.Fragment key={`${cacheKey}-child-${j}`}>
                                {renderNode(childCol, filters, depth, sortMode)}
                            </React.Fragment>
                        ))}
                    </React.Fragment>
                );
            }

            return null;
        }

        return (
            <div
                key={`node-${table_column_id}-${depth}-${name}`}
                style={{marginLeft: depth > 0 ? 16 : 0}}
            >
                {name && depth > 0 && (
                    <div className={s.treeHeader} style={{fontSize: 12, opacity: 0.8}}>
                        <span>{name}</span>
                    </div>
                )}

                <ul className={s.treeUl}>
                    {sortedPairs.map(({value, displayValue}) => {
                        const filters = [...parentFilters, {table_column_id, value}];
                        const expandKey = makeExpandKey(filters);
                        const cacheKey = makeCacheKey(filters);
                        const isExpanded = expandedKeys.has(expandKey);
                        const isLoading = loadingKeys.has(expandKey);
                        const children = childrenCache[cacheKey] ?? [];

                        return (
                            <li key={expandKey}>
                                <div
                                    className={`${s.treeItem} ${isExpanded ? s.treeItemExpanded : ''}`}
                                    onClick={() => handleNodeClick(table_column_id, value, parentFilters)}
                                    style={{cursor: 'pointer'}}
                                >
                                    <span>{displayValue}</span>
                                    {isLoading && (
                                        <span style={{marginLeft: 8, opacity: 0.5}}>⏳</span>
                                    )}
                                    {!isLoading && (
                                        <span style={{marginLeft: 8, opacity: 0.5}}>
                                            {isExpanded ? '▼' : '▶'}
                                        </span>
                                    )}
                                </div>

                                {isExpanded && children.length > 0 && (
                                    <ul className={s.nestedUl}>
                                        {children.map((childCol, j) => (
                                            <li key={`${cacheKey}-child-${j}`}>
                                                {renderNode(childCol, filters, depth + 1, sortMode)}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }, [expandedKeys, loadingKeys, childrenCache, handleNodeClick]);

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    if (!tree || tree.length === 0) return null;
    if (!selectedFormId) return null;

    return (
        <div className={s.treeContainer}>
            {tree.map((treeColumn, idx) => {
                const mode: SortMode = sortModes[idx] ?? 'asc';
                const title = mode === 'asc' ? 'А→Я / 0→9' : 'Я→А / 9→0';
                const pairs = getValuePairs(treeColumn);
                const sortedPairs = sortValuePairs(pairs, mode);

                return (
                    <div key={`root-${treeColumn.table_column_id}-${idx}`}>
                        <div className={s.treeHeader}>
                            <span style={{fontWeight: 600}}>{treeColumn.name}</span>
                            <div
                                onClick={() => toggleSort(idx)}
                                title={title}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    marginLeft: 8,
                                    transform: mode === 'desc' ? 'rotate(180deg)' : undefined,
                                    background: 'transparent',
                                    border: 0,
                                    padding: 0,
                                    cursor: 'pointer',
                                }}
                            >
                                <SortIcon className={s.iconTree}/>
                            </div>
                        </div>

                        <ul className={s.treeUl}>
                            {sortedPairs.map(({value, displayValue}) => {
                                const filters: Filter[] = [{table_column_id: treeColumn.table_column_id, value}];
                                const expandKey = makeExpandKey(filters);
                                const cacheKey = makeCacheKey(filters);
                                const isExpanded = expandedKeys.has(expandKey);
                                const isLoading = loadingKeys.has(expandKey);
                                const children = childrenCache[cacheKey] ?? [];

                                return (
                                    <li key={expandKey}>
                                        <div
                                            className={`${s.treeItem} ${isExpanded ? s.treeItemExpanded : ''}`}
                                            onClick={() => handleNodeClick(treeColumn.table_column_id, value, [])}
                                            style={{cursor: 'pointer'}}
                                        >
                                            <span>{displayValue}</span>
                                            {isLoading && (
                                                <span style={{marginLeft: 8, opacity: 0.5}}>⏳</span>
                                            )}
                                            {!isLoading && (
                                                <span style={{marginLeft: 8, opacity: 0.5}}>
                                                    {isExpanded ? '▼' : '▶'}
                                                </span>
                                            )}
                                        </div>

                                        {isExpanded && children.length > 0 && (
                                            <ul className={s.nestedUl}>
                                                {children.map((childCol, j) => (
                                                    <li key={`${cacheKey}-child-${j}`}>
                                                        {renderNode(childCol, filters, 1, mode)}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
};