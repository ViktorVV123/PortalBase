import React, { memo } from 'react';
import * as s from '../TopComponent.module.scss';
import AddIcon from '@/assets/image/AddIcon.svg';
import WidgetsIcon from '@/assets/image/WidgetsIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import { DTable, Widget } from '@/shared/hooks/useWorkSpaces';
import {MenuLoader} from "@/components/topComponent/menuLoader/Menuloader";


type Props = {
    table: DTable;
    widgets: Widget[];
    isDesktop: boolean;
    wOpenId: number | null;
    loading?: boolean;  // ← НОВОЕ
    onCreateWidget: (t: DTable) => void;
    onOpenWidget: (w: Widget, anchor: HTMLElement | null) => void;
    onSelectWidget: (t: DTable, w: Widget) => void;
    onDeleteWidget: (w: Widget, t: DTable) => void;
};

export const WidgetsMenu = memo(function WidgetsMenu({
                                                         table,
                                                         widgets,
                                                         isDesktop,
                                                         wOpenId,
                                                         loading = false,
                                                         onCreateWidget,
                                                         onOpenWidget,
                                                         onSelectWidget,
                                                         onDeleteWidget,
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
                            onCreateWidget(table);
                        }}
                    >
                        <AddIcon className={s.icon} />
                        <span className={s.label}>Создать виджет</span>
                    </button>
                </li>
            </ul>

            <div className={s.sectionTitle}>Виджеты</div>

            {loading ? (
                <MenuLoader text="Загрузка виджетов..." />
            ) : (
                <ul className={s.list} role="none">
                    {widgets.length === 0 ? (
                        <li className={s.item} data-disabled="true" role="none">
                            <div className={s.itemBtn} style={{ cursor: 'default' }}>
                                <WidgetsIcon className={s.icon} />
                                <span className={s.label}>Нет виджетов</span>
                            </div>
                        </li>
                    ) : (
                        widgets.map((w) => (
                            <li
                                key={w.id}
                                className={s.item}
                                role="none"
                                onMouseEnter={
                                    isDesktop
                                        ? (e) => onOpenWidget(w, e.currentTarget as unknown as HTMLElement)
                                        : undefined
                                }
                            >
                                <button
                                    className={`${s.itemBtn} ${s.hasSub}`}
                                    role="menuitem"
                                    aria-haspopup="menu"
                                    aria-expanded={wOpenId === w.id}
                                    onClick={(e) => {
                                        if (!isDesktop) {
                                            if (wOpenId === w.id)
                                                onOpenWidget({ ...w, id: null as unknown as number }, null);
                                            else onOpenWidget(w, e.currentTarget as unknown as HTMLElement);
                                            return;
                                        }
                                        onSelectWidget(table, w);
                                    }}
                                    title={w.description || w.name}
                                >
                                    <WidgetsIcon className={s.icon} />
                                    <span className={s.label}>{w.name}</span>
                                    <span className={s.actions}>
                                        <DeleteIcon
                                            className={`${s.actionIcon} ${s.actionDanger}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteWidget(w, table);
                                            }}
                                        />
                                    </span>
                                </button>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </>
    );
});