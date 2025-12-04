import React from 'react';
import AddIcon from '@mui/icons-material/AddBox';
import * as s from '../WidgetGroup.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import ArrowUpIcon from '@/assets/image/ArrowUpIcon.svg';
import ArrowDownIcon from '@/assets/image/ArrowDownIcon.svg';
import { RefRow, RefRowProps } from './RefRow';
import type { RefItem } from '../types';

type TbodyDndHandlers = {
    onDragOver: (e: React.DragEvent<HTMLTableSectionElement>) => void;
    onDropTbodyEnd: (wcId: number) => (e: React.DragEvent<HTMLTableSectionElement>) => void;
};

type Props = {
    wcId: number;
    title: string;
    order: number;
    refs: RefItem[];
    isFirst: boolean;
    isLast: boolean;
    moveGroup: (wcId: number, dir: 'up' | 'down') => void;
    onOpenAlias: () => void;
    onDeleteGroup: () => void;
    onAddField: () => void;
    rowProps: Omit<RefRowProps, 'wcId' | 'r' | 'formText' | 'visibleText'> & TbodyDndHandlers;
    formNameById: Record<string, string>;
    onOpenComboCreate: (wcId: number, tblColId: number, preset?: Partial<{
        combobox_column_id: number | null;
        combobox_width: number;
        combobox_column_order: number;
        combobox_alias: string;
        is_primary: boolean;
        is_show: boolean;
        is_show_hidden: boolean;
    }>) => void;
};

export const WidgetGroup: React.FC<Props> = ({
                                                 wcId,
                                                 title,
                                                 order,
                                                 refs,
                                                 isFirst,
                                                 isLast,
                                                 moveGroup,
                                                 onOpenAlias,
                                                 onDeleteGroup,
                                                 onAddField,
                                                 rowProps,
                                                 formNameById,
                                             }) => {
    return (
        <div className={s.root}>
            <div className={s.header}>
                <h4 className={s.title}>{title}</h4>
                <span className={s.order}>({order})</span>

                <div className={s.headerActions}>
                    <ArrowUpIcon
                        onClick={!isFirst ? () => moveGroup(wcId, 'up') : undefined}
                        aria-label="Переместить группу вверх"
                        className={s.actionIcon}
                        style={{
                            opacity: isFirst ? 0.3 : 1,
                            cursor: isFirst ? 'default' : 'pointer',
                            pointerEvents: isFirst ? 'none' : 'auto',
                        }}
                    />

                    <ArrowDownIcon
                        onClick={!isLast ? () => moveGroup(wcId, 'down') : undefined}
                        aria-label="Переместить группу вниз"
                        className={s.actionIcon}
                        style={{
                            opacity: isLast ? 0.3 : 1,
                            cursor: isLast ? 'default' : 'pointer',
                            pointerEvents: isLast ? 'none' : 'auto',
                        }}
                    />

                    <button
                        type="button"
                        className={s.iconBtn}
                        onClick={onOpenAlias}
                        aria-label="Переименовать alias"
                    >
                        <EditIcon className={s.actionIcon} />
                    </button>

                    <button
                        type="button"
                        className={s.iconBtn}
                        onClick={onDeleteGroup}
                        aria-label="Удалить группу"
                    >
                        <DeleteIcon className={s.actionIcon} />
                    </button>

                    <button
                        type="button"
                        className={s.addBtn}
                        onClick={onAddField}
                        title="Добавить поле в эту группу"
                        aria-label="Добавить поле в группу"
                    >
                        <AddIcon />
                    </button>
                </div>
            </div>

            <div className={s.tableWrapper}>
                <table className={s.tbl}>
                    <thead>
                    <tr>
                        <th className={s.colDrag} />
                        <th className={s.colName}>Название</th>
                        <th className={s.colSub}>Подзаголовок</th>
                        <th className={s.colType}>Тип</th>
                        <th className={s.colBool}>Только чтение</th>
                        <th className={s.colNumber}>Ширина</th>
                        <th className={s.colNumber}>default</th>
                        <th className={s.colPlaceholder}>placeholder</th>
                        <th className={s.colBool}>Видимость</th>
                        <th className={s.colNumber}>Очередность</th>
                        <th className={s.colCombo}>Combobox</th>
                        <th className={s.colForm}>Формы</th>
                        <th className={s.colId}>id</th>
                        <th className={s.colActions} />
                    </tr>
                    </thead>

                    <tbody
                        onDragOver={rowProps.onDragOver}
                        onDrop={rowProps.onDropTbodyEnd(wcId)}
                    >
                    {refs.length > 0 ? (
                        refs.map((r) => {
                            const formId = (r as any).form_id ?? (r as any).form;
                            const formText =
                                formId != null
                                    ? formNameById[String(formId)] ?? `#${formId}`
                                    : formNameById['null'];

                            return (
                                <RefRow
                                    key={`${wcId}:${r.table_column?.id}`}
                                    wcId={wcId}
                                    r={r}
                                    visibleText={(r.visible ?? true) ? '✓' : '✗'}
                                    formText={formText}
                                    {...rowProps}
                                />
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan={14} className={s.emptyCell}>
                                Нет связей — перетащите сюда строку из другого блока или нажмите «+ поле»
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
