// src/components/Form/treeForm/TreeDrawer.tsx

import React from 'react';
import * as s from './TreeDrawer.module.scss';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { TreeFormTable } from './TreeFormTable';
import type { FormTreeColumn } from '@/shared/hooks/useWorkSpaces';

type Filter = { table_column_id: number; value: string | number };

type TreeDrawerProps = {
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;

    // Props для TreeFormTable
    tree: FormTreeColumn[] | null;
    selectedFormId: number | null;
    handleTreeValueClick: (table_column_id: number, value: string | number) => void;
    handleNestedValueClick: (table_column_id: number, value: string | number) => void;
    onFilterMain?: (filters: Filter[]) => Promise<void>;
    expandedKeys: Set<string>;
    setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    childrenCache: Record<string, FormTreeColumn[]>;
    setChildrenCache: React.Dispatch<React.SetStateAction<Record<string, FormTreeColumn[]>>>;
    onResetFilters?: () => Promise<void>;
};

export const TreeDrawer: React.FC<TreeDrawerProps> = ({
                                                          isOpen,
                                                          onToggle,
                                                          onClose,
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
    // Если нет дерева — не показываем даже кнопку
    const hasTree = !!(tree && tree.length > 0);

    if (!hasTree) return null;

    return (
        <>
            {/* Кнопка открытия (всегда видна когда drawer закрыт) */}
            {!isOpen && (
                <button
                    type="button"
                    className={s.toggleBtn}
                    onClick={onToggle}
                    title="Открыть фильтры"
                    aria-label="Открыть панель фильтров"
                >
                    <AccountTreeIcon className={s.toggleIcon} />
                </button>
            )}

            {/* Backdrop (затемнение) */}
            {isOpen && (
                <div
                    className={s.backdrop}
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Drawer панель */}
            <aside
                className={`${s.drawer} ${isOpen ? s.drawerOpen : ''}`}
                aria-hidden={!isOpen}
            >
                {/* Заголовок drawer */}
                <div className={s.drawerHeader}>
                    <span className={s.drawerTitle}>
                        <AccountTreeIcon style={{ fontSize: 20, marginRight: 8 }} />
                        Фильтры
                    </span>
                    <button
                        type="button"
                        className={s.closeBtn}
                        onClick={onClose}
                        title="Закрыть"
                        aria-label="Закрыть панель фильтров"
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* Содержимое — TreeFormTable */}
                <div className={s.drawerContent}>
                    <TreeFormTable
                        tree={tree}
                        selectedFormId={selectedFormId}
                        handleTreeValueClick={handleTreeValueClick}
                        handleNestedValueClick={handleNestedValueClick}
                        onFilterMain={onFilterMain}
                        expandedKeys={expandedKeys}
                        setExpandedKeys={setExpandedKeys}
                        childrenCache={childrenCache}
                        setChildrenCache={setChildrenCache}
                        onResetFilters={onResetFilters}
                    />
                </div>
            </aside>
        </>
    );
};