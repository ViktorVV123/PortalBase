import React, {useState, useCallback} from 'react';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import SortIcon from "@/assets/image/SortIcon.svg";
import {FormTreeColumn, WidgetForm} from "@/shared/hooks/useWorkSpaces";

type TreeFormTableProps = {
    tree: FormTreeColumn[] | null;
    widgetForm: WidgetForm | null;
    handleResetFilters: () => void;
    activeExpandedKey: string | null;
    handleTreeValueClick: (table_column_id: number, value: string | number) => void;
    nestedTrees: Record<string, FormTreeColumn[]>;
    handleNestedValueClick: (table_column_id: number, value: string | number) => void;
};

type SortMode = 'asc' | 'desc';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortValues(values: (string | number)[], mode: SortMode) {
    const dir = mode === 'asc' ? 1 : -1;
    return [...values].sort((a, b) => collator.compare(String(a), String(b)) * dir);
}

export const TreeFormTable = ({
                                  tree,
                                  widgetForm,
                                  activeExpandedKey,
                                  handleTreeValueClick,
                                  nestedTrees,
                                  handleNestedValueClick,
                              }: TreeFormTableProps) => {
    // режим на каждый блок дерева; по умолчанию — ASC
    const [sortModes, setSortModes] = useState<Record<number, SortMode>>({});

    const toggleSort = useCallback((idx: number) => {
        setSortModes(prev => ({ ...prev, [idx]: (prev[idx] ?? 'asc') === 'asc' ? 'desc' : 'asc' }));
    }, []);

    if (!tree || tree.length === 0) return null;

    return (
        <div>
            {tree.map(({ name, values }, idx) => {
                const columnId = widgetForm?.tree_fields?.[idx]?.table_column_id ?? null;

                const mode: SortMode = sortModes[idx] ?? 'asc';
                const sortedTop = sortValues(values as (string | number)[], mode);

                const title =
                    mode === 'asc'
                        ? 'Сортировка: А→Я / 0→9 (клик — Я→А/9→0)'
                        : 'Сортировка: Я→А / 9→0 (клик — А→Я/0→9)';

                return (
                    <div key={`${name}-${idx}`} className={s.treeList}>
                        <div className={s.treeHeader}>
                            <span>{name}</span>
                            <button
                                type="button"
                                onClick={() => toggleSort(idx)}
                                title={title}
                                aria-label={title}

                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: 8,
                                    transform: mode === 'desc' ? 'rotate(180deg)' : undefined,
                                    background: 'transparent',
                                    border: 0,
                                    padding: 0,
                                    cursor: 'pointer',
                                }}
                            >
                                <SortIcon color={'white'} />
                            </button>
                        </div>

                        <ul className={s.treeUl}>
                            {sortedTop.map((v, i) => {
                                const key = `${columnId}-${v}`;
                                const isExpanded = key === activeExpandedKey;

                                return (
                                    <li key={i}>
                                        <div
                                            className={s.treeItem}
                                            onClick={() => {
                                                if (columnId != null) handleTreeValueClick(columnId, v);
                                            }}
                                        >
                                            {v}
                                        </div>

                                        {isExpanded && (
                                            <ul className={s.nestedUl}>
                                                {(nestedTrees[key] ?? []).map(({ values, table_column_id }, j) => {
                                                    // ✦ сортируем вложенные значения тем же режимом
                                                    const sortedNested = sortValues(values as (string | number)[], mode);
                                                    return sortedNested.map((val, k) => (
                                                        <li
                                                            key={`nested-${i}-${j}-${k}`}
                                                            className={s.nestedItem}
                                                            onClick={() => handleNestedValueClick(table_column_id, val)}
                                                        >
                                                            {val}
                                                        </li>
                                                    ));
                                                })}
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
