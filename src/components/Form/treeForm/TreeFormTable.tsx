// src/components/Form/treeForm/TreeFormTable.tsx

import React, {useState, useCallback, useEffect, useRef} from 'react';
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
};

type SortMode = 'asc' | 'desc';

// ─────────────────────────────────────────────────────────────
// УТИЛИТЫ
// ─────────────────────────────────────────────────────────────

const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

function sortValues(values: (string | number | null)[], mode: SortMode): (string | number)[] {
    const filtered = values.filter((v): v is string | number => v != null);
    const dir = mode === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => collator.compare(String(a), String(b)) * dir);
}

/** Проверка: это GUID? */
function isGuidLike(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Нужно ли автоматически раскрыть? */
function shouldAutoExpand(values: (string | number | null)[]): boolean {
    const filtered = values.filter((v) => v != null);
    return filtered.length === 1 && isGuidLike(filtered[0]);
}

/** Добавить ключ в Set */
function addToSet(set: Set<string>, key: string): Set<string> {
    const next = new Set<string>();
    set.forEach((k) => next.add(k));
    next.add(key);
    return next;
}

/** Удалить ключ из Set */
function removeFromSet(set: Set<string>, key: string): Set<string> {
    const next = new Set<string>();
    set.forEach((k) => {
        if (k !== key) next.add(k);
    });
    return next;
}

/** Добавить несколько ключей в Set */
function addMultipleToSet(set: Set<string>, keys: string[]): Set<string> {
    const next = new Set<string>();
    set.forEach((k) => next.add(k));
    keys.forEach((k) => next.add(k));
    return next;
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
                                                            }) => {
    const [sortModes, setSortModes] = useState<Record<number, SortMode>>({});

    const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

    // Сброс при смене формы
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
    // РЕКУРСИВНАЯ ЗАГРУЗКА С АВТОРАСКРЫТИЕМ
    // ═══════════════════════════════════════════════════════════

    /**
     * Загружает детей и рекурсивно раскрывает GUID-узлы.
     * Возвращает:
     * - expandedKeys: все ключи которые нужно раскрыть
     * - cache: все загруженные дети
     * - finalFilters: финальные фильтры для MainTable (последний не-GUID уровень)
     */
    const loadAndExpandRecursively = useCallback(async (
        table_column_id: number,
        value: string | number,
        parentFilters: Array<{ table_column_id: number; value: string | number }>,
        currentCache: Record<string, FormTreeColumn[]>
    ): Promise<{
        keysToExpand: string[];
        newCache: Record<string, FormTreeColumn[]>;
        finalFilters: Array<{ table_column_id: number; value: string | number }>;
    }> => {
        if (!selectedFormId) {
            return {keysToExpand: [], newCache: currentCache, finalFilters: parentFilters};
        }

        const key = `${table_column_id}-${value}`;
        const filters = [...parentFilters, {table_column_id, value}];
        const keysToExpand: string[] = [key];
        let newCache = {...currentCache};

        // Загружаем детей если нет в кэше
        let children = currentCache[key];
        if (!children) {
            try {
                const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(
                    `/display/${selectedFormId}/tree`,
                    filters.map((f) => ({...f, value: String(f.value)}))
                );
                children = Array.isArray(data) ? data : [data];
                newCache = {...newCache, [key]: children};
            } catch (e) {
                console.warn('[TreeFormTable] Failed to load:', key, e);
                return {keysToExpand, newCache, finalFilters: filters};
            }
        }

        // Если нет детей — это конечный уровень
        if (!children || children.length === 0) {
            return {keysToExpand, newCache, finalFilters: filters};
        }

        // Проверяем каждого ребёнка на автораскрытие
        let finalFilters = filters;

        for (const child of children) {
            if (shouldAutoExpand(child.values)) {
                const childValue = child.values.filter((v) => v != null)[0];
                if (childValue != null) {
                    // Рекурсивно раскрываем
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
        parentFilters: Array<{ table_column_id: number; value: string | number }>
    ) => {
        const key = `${table_column_id}-${value}`;

        // Если уже раскрыт — сворачиваем
        if (expandedKeys.has(key)) {
            setExpandedKeys((prev) => removeFromSet(prev, key));
            return;
        }

        // ═══════════════════════════════════════════════════════════
        // ЗАКРЫВАЕМ ВСЕ ЭЛЕМЕНТЫ ТОГО ЖЕ table_column_id И ИХ ПОТОМКОВ
        // ═══════════════════════════════════════════════════════════

        const prefix = `${table_column_id}-`;
        const keysToRemove: string[] = [];

        // Собираем ключи для закрытия
        expandedKeys.forEach((existingKey) => {
            if (existingKey.startsWith(prefix) && existingKey !== key) {
                keysToRemove.push(existingKey);
            }
        });

        // Также закрываем всех потомков закрываемых ключей
        const allKeysToRemove = new Set(keysToRemove);

        keysToRemove.forEach((keyToRemove) => {
            // Рекурсивно находим всех потомков через кэш
            const findDescendants = (parentKey: string) => {
                const children = childrenCache[parentKey];
                if (!children) return;

                children.forEach((child) => {
                    child.values.forEach((v) => {
                        if (v != null) {
                            const childKey = `${child.table_column_id}-${v}`;
                            if (expandedKeys.has(childKey)) {
                                allKeysToRemove.add(childKey);
                                findDescendants(childKey);
                            }
                        }
                    });
                });
            };

            findDescendants(keyToRemove);
        });

        // Показываем загрузку
        setLoadingKeys((prev) => addToSet(prev, key));

        try {
            // Загружаем рекурсивно с автораскрытием
            const {keysToExpand, newCache, finalFilters} = await loadAndExpandRecursively(
                table_column_id,
                value,
                parentFilters,
                childrenCache
            );

            // Обновляем кэш
            setChildrenCache(newCache);

            // Обновляем expandedKeys: убираем старые, добавляем новые
            setExpandedKeys((prev) => {
                let result = prev;

                // Убираем соседей и их потомков
                allKeysToRemove.forEach((k) => {
                    result = removeFromSet(result, k);
                });

                // Добавляем новые
                return addMultipleToSet(result, keysToExpand);
            });

            // Фильтруем MainTable
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
            setLoadingKeys((prev) => removeFromSet(prev, key));
        }
    }, [
        expandedKeys,
        childrenCache,
        loadAndExpandRecursively,
        onFilterMain,
        handleTreeValueClick,
        handleNestedValueClick,
    ]);


    // ═══════════════════════════════════════════════════════════
    // РЕНДЕР УЗЛА
    // ═══════════════════════════════════════════════════════════

    const renderNode = useCallback((
        treeColumn: FormTreeColumn,
        parentFilters: Array<{ table_column_id: number; value: string | number }>,
        depth: number,
        sortMode: SortMode
    ): React.ReactNode => {
        const {name, table_column_id, values} = treeColumn;
        const sortedValues = sortValues(values, sortMode);
        const isAutoExpandNode = shouldAutoExpand(values);

        // Для узлов с единственным GUID — не показываем заголовок и сам GUID
        if (isAutoExpandNode) {
            const guidValue = values.filter((v) => v != null)[0] as string | number;
            const key = `${table_column_id}-${guidValue}`;
            const children = childrenCache[key] ?? [];
            const isExpanded = expandedKeys.has(key);

            // Если раскрыт — показываем только детей
            if (isExpanded && children.length > 0) {
                return (
                    <React.Fragment key={`auto-${key}`}>
                        {children.map((childCol, j) => (
                            <React.Fragment key={`${key}-child-${j}`}>
                                {renderNode(
                                    childCol,
                                    [...parentFilters, {table_column_id, value: guidValue}],
                                    depth,
                                    sortMode
                                )}
                            </React.Fragment>
                        ))}
                    </React.Fragment>
                );
            }

            // Если не раскрыт — ничего не показываем (будет загружено автоматически)
            return null;
        }

        return (
            <div
                key={`node-${table_column_id}-${depth}-${name}`}
                style={{marginLeft: depth > 0 ? 16 : 0}}
            >
                {/* Заголовок уровня */}
                {name && depth > 0 && (
                    <div className={s.treeHeader} style={{fontSize: 12, opacity: 0.8}}>
                        <span>{name}</span>
                    </div>
                )}

                <ul className={s.treeUl}>
                    {sortedValues.map((v) => {
                        const key = `${table_column_id}-${v}`;
                        const isExpanded = expandedKeys.has(key);
                        const isLoading = loadingKeys.has(key);
                        const children = childrenCache[key] ?? [];

                        return (
                            <li key={key}>
                                <div
                                    className={`${s.treeItem} ${isExpanded ? s.treeItemExpanded : ''}`}
                                    onClick={() => handleNodeClick(table_column_id, v, parentFilters)}
                                    style={{cursor: 'pointer'}}
                                >
                                    <span>{v}</span>
                                    {isLoading && (
                                        <span style={{marginLeft: 8, opacity: 0.5}}>⏳</span>
                                    )}
                                    {!isLoading && (
                                        <span style={{marginLeft: 8, opacity: 0.5}}>
                                            {isExpanded ? '▼' : '▶'}
                                        </span>
                                    )}
                                </div>

                                {/* Дети */}
                                {isExpanded && children.length > 0 && (
                                    <ul className={s.nestedUl}>
                                        {children.map((childCol, j) => (
                                            <li key={`${key}-child-${j}`}>
                                                {renderNode(
                                                    childCol,
                                                    [...parentFilters, {table_column_id, value: v}],
                                                    depth + 1,
                                                    sortMode
                                                )}
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
                const sortedValues = sortValues(treeColumn.values, mode);

                return (
                    <div key={`root-${treeColumn.table_column_id}-${idx}`}>
                        {/* Заголовок */}
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
                                <SortIcon className={s.iconTree} />
                            </div>
                        </div>

                        {/* Корневые значения */}
                        <ul className={s.treeUl}>
                            {sortedValues.map((v) => {
                                const key = `${treeColumn.table_column_id}-${v}`;
                                const isExpanded = expandedKeys.has(key);
                                const isLoading = loadingKeys.has(key);
                                const children = childrenCache[key] ?? [];

                                return (
                                    <li key={key}>
                                        <div
                                            className={`${s.treeItem} ${isExpanded ? s.treeItemExpanded : ''}`}
                                            onClick={() => handleNodeClick(treeColumn.table_column_id, v, [])}
                                            style={{cursor: 'pointer'}}
                                        >
                                            <span>{v}</span>
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
                                                    <li key={`${key}-child-${j}`}>
                                                        {renderNode(
                                                            childCol,
                                                            [{table_column_id: treeColumn.table_column_id, value: v}],
                                                            1,
                                                            mode
                                                        )}
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