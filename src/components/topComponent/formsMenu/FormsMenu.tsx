import React, { memo } from 'react';
import * as s from '../TopComponent.module.scss';
import AddIcon from '@/assets/image/AddIcon.svg';
import FormIcon from '@/assets/image/FormaIcon1.svg';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import { DTable, Widget, WidgetForm } from '@/shared/hooks/useWorkSpaces';

const clip = (str: string, n = 40) => (str.length > n ? str.slice(0, n) + '…' : str);

type Props = {
    table: DTable;
    widget: Widget;
    forms: WidgetForm[];
    onCreateForm: (w: Widget) => void;
    onSelectForm: (t: DTable, w: Widget, form: WidgetForm) => void;
    onEditForm: (f: WidgetForm) => void;
    onDeleteForm: (f: WidgetForm) => void;
};

export const FormsMenu = memo(function FormsMenu({
                                                     table,
                                                     widget,
                                                     forms,
                                                     onCreateForm,
                                                     onSelectForm,
                                                     onEditForm,
                                                     onDeleteForm,
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
                            onCreateForm(widget);
                        }}
                    >
                        <AddIcon className={s.icon} />
                        <span className={s.label}>Создать форму</span>
                    </button>
                </li>
            </ul>

            <div className={s.sectionTitle}>Формы</div>
            <ul className={s.list} role="none">
                {(forms ?? []).map((form) => (
                    <li key={form.form_id} className={s.item} role="none">
                        <button
                            className={s.itemBtn}
                            role="menuitem"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectForm(table, widget, form);
                            }}
                            title={form.name}
                        >
                            <FormIcon className={s.icon} />
                            <span className={s.label}>{clip(form.name)}</span>
                            <span className={s.actions}>
                <EditIcon
                    className={s.actionIcon}
                    onClick={(e) => {
                        e.stopPropagation();
                        onEditForm(form);
                    }}
                />
                <DeleteIcon
                    className={`${s.actionIcon} ${s.actionDanger}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteForm(form);
                    }}
                />
              </span>
                        </button>
                    </li>
                ))}
                {(forms?.length ?? 0) === 0 && (
                    <li className={s.item} role="none">
                        <div role="menuitem" style={{ cursor: 'default' }} />
                    </li>
                )}
            </ul>
        </>
    );
});
