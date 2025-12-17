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

/** Пара value + displayValue для удобной работы */
type ValuePair = {
    value: string | number;
    displayValue: string | number;
};

// ─────────────────────────────────────────────────────────────
// УТИЛИТЫ
// ─────────────────────────────────────────────────────────────

const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

/** Сортировка по displayValue */
function sortValuePairs(pairs: ValuePair[], mode: SortMode): ValuePair[] {
    const dir = mode === 'asc' ? 1 : -1;
    return [...pairs].sort((a, b) =>
        collator.compare(String(a.displayValue), String(b.displayValue)) * dir
    );
}

/** Создаём пары value + displayValue из колонки */
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

/** Проверка: это GUID? */
function isGuidLike(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Нужно ли автоматически раскрыть?
 * Автораскрытие только если:
 * - Единственное значение
 * - value === displayValue (т.е. нет читаемого имени)
 * - И это GUID
 */
function shouldAutoExpand(treeColumn: FormTreeColumn): boolean {
    const values = (treeColumn.values ?? []).filter((v) => v != null);
    const displayValues = ((treeColumn as any).display_values ?? []).filter((v: any) => v != null);

    // Только если одно значение
    if (values.length !== 1) return false;

    const val = values[0];
    const displayVal = displayValues[0] ?? val;

    // Автораскрытие только если value === displayValue (нет человекочитаемого имени)
    // и это GUID
    return isGuidLike(val) && val === displayVal;
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
                                                                onResetFilters,
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
        parentFilters: Array<{ table_column_id: number; value: string | number }>
    ) => {
        const key = `${table_column_id}-${value}`;

// ═══════════════════════════════════════════════════════════
        // ЕСЛИ УЖЕ РАСКРЫТ — СВОРАЧИВАЕМ И УБИРАЕМ ФИЛЬТР
        // ═══════════════════════════════════════════════════════════

        if (expandedKeys.has(key)) {
            // Сворачиваем узел и всех его потомков
            const keysToRemove: string[] = [key];

            const findDescendants = (parentKey: string) => {
                const children = childrenCache[parentKey];
                if (!children) return;

                children.forEach((child) => {
                    child.values.forEach((v) => {
                        if (v != null) {
                            const childKey = `${child.table_column_id}-${v}`;
                            if (expandedKeys.has(childKey)) {
                                keysToRemove.push(childKey);
                                findDescendants(childKey);
                            }
                        }
                    });
                });
            };

            findDescendants(key);

            setExpandedKeys((prev) => {
                let result = prev;
                keysToRemove.forEach((k) => {
                    result = removeFromSet(result, k);
                });
                return result;
            });

            // Применяем фильтры родительского уровня
            if (parentFilters.length === 0) {
                // Корневой уровень — сбрасываем все фильтры
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
        // РАСКРЫВАЕМ НОВЫЙ УЗЕЛ (код без изменений)
        // ═══════════════════════════════════════════════════════════

        const prefix = `${table_column_id}-`;
        const keysToRemove: string[] = [];

        expandedKeys.forEach((existingKey) => {
            if (existingKey.startsWith(prefix) && existingKey !== key) {
                keysToRemove.push(existingKey);
            }
        });

        const allKeysToRemove = new Set(keysToRemove);

        keysToRemove.forEach((keyToRemove) => {
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

        setLoadingKeys((prev) => addToSet(prev, key));

        try {
            const {keysToExpand, newCache, finalFilters} = await loadAndExpandRecursively(
                table_column_id,
                value,
                parentFilters,
                childrenCache
            );

            setChildrenCache(newCache);

            setExpandedKeys((prev) => {
                let result = prev;
                allKeysToRemove.forEach((k) => {
                    result = removeFromSet(result, k);
                });
                return addMultipleToSet(result, keysToExpand);
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
            setLoadingKeys((prev) => removeFromSet(prev, key));
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
        parentFilters: Array<{ table_column_id: number; value: string | number }>,
        depth: number,
        sortMode: SortMode
    ): React.ReactNode => {
        const {name, table_column_id} = treeColumn;
        const pairs = getValuePairs(treeColumn);
        const sortedPairs = sortValuePairs(pairs, sortMode);
        const isAutoExpandNode = shouldAutoExpand(treeColumn);

        // Для узлов с автораскрытием — пропускаем рендер самого узла
        if (isAutoExpandNode) {
            const guidValue = pairs[0]?.value;
            if (guidValue == null) return null;

            const key = `${table_column_id}-${guidValue}`;
            const children = childrenCache[key] ?? [];
            const isExpanded = expandedKeys.has(key);

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
                        const key = `${table_column_id}-${value}`;
                        const isExpanded = expandedKeys.has(key);
                        const isLoading = loadingKeys.has(key);
                        const children = childrenCache[key] ?? [];

                        return (
                            <li key={key}>
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
                                            <li key={`${key}-child-${j}`}>
                                                {renderNode(
                                                    childCol,
                                                    [...parentFilters, {table_column_id, value}],
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
                                const key = `${treeColumn.table_column_id}-${value}`;
                                const isExpanded = expandedKeys.has(key);
                                const isLoading = loadingKeys.has(key);
                                const children = childrenCache[key] ?? [];

                                return (
                                    <li key={key}>
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
                                                    <li key={`${key}-child-${j}`}>
                                                        {renderNode(
                                                            childCol,
                                                            [{table_column_id: treeColumn.table_column_id, value}],
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