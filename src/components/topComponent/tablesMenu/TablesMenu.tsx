import React, { memo } from 'react';
import * as s from '../TopComponent.module.scss';
import AddIcon from '@/assets/image/AddIcon.svg';
import TableIcon from '@/assets/image/TableIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import { DTable } from '@/shared/hooks/useWorkSpaces';
import { WorkSpaceTypes } from '@/types/typesWorkSpaces';

type Props = {
    ws: WorkSpaceTypes;
    tables: DTable[];
    isDesktop: boolean;
    tblOpenId: number | null;
    onCreateTable: (ws: WorkSpaceTypes) => void;
    onOpenTable: (t: DTable, anchor: HTMLElement | null) => void;
    onSelectTable: (t: DTable) => void;
    onDeleteTable: (t: DTable) => void;
};

export const TablesMenu = memo(function TablesMenu({
                                                       ws,
                                                       tables,
                                                       isDesktop,
                                                       tblOpenId,
                                                       onCreateTable,
                                                       onOpenTable,
                                                       onSelectTable,
                                                       onDeleteTable,
                                                   }: Props) {
    return (
        <>
            <div className={s.sectionTitle}>Действия</div>
            <ul className={s.list} role="none">
                <li className={s.item} data-disabled="true" role="none">
                    <button
                        className={s.itemBtn}
                        role="menuitem"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateTable(ws);
                        }}
                    >
                        <AddIcon className={s.icon} />
                        <span className={s.label}>Создать таблицу</span>
                    </button>
                </li>
            </ul>

            <div className={s.sectionTitle}>Таблицы</div>
            <ul className={s.list} role="none">
                {(tables ?? []).map((t) => (
                    <li
                        key={t.id}
                        className={s.item}
                        role="none"
                        onMouseEnter={
                            isDesktop ? (e) => onOpenTable(t, e.currentTarget as unknown as HTMLElement) : undefined
                        }
                    >
                        <button
                            className={`${s.itemBtn} ${s.hasSub}`}
                            role="menuitem"
                            aria-haspopup="menu"
                            aria-expanded={tblOpenId === t.id}
                            onClick={async (e) => {
                                if (!isDesktop) {
                                    if (tblOpenId === t.id) {
                                        onOpenTable({ ...t, id: null as unknown as number }, null);
                                    } else {
                                        await onOpenTable(t, e.currentTarget as unknown as HTMLElement);
                                    }
                                    return;
                                }
                                onSelectTable(t);
                            }}
                            title={t.description || t.name}
                        >
                            <TableIcon className={s.icon} />
                            <span className={s.label}>{t.name}</span>
                            <span className={s.actions}>
                <DeleteIcon
                    className={`${s.actionIcon} ${s.actionDanger}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTable(t);
                    }}
                />
              </span>
                        </button>
                    </li>
                ))}
            </ul>
        </>
    );
});
