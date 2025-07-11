// components/sideNav/SideNav.tsx
import React from 'react';
import * as s from './SideNav.module.scss';

import FormaIcon from '@/assets/image/FormaIcon1.svg';

import AddIcon from '@/assets/image/AddIcon.svg';

interface Props {
    open: boolean;
    toggle: () => void;

    /** показать модалку "создать workspace" */
    changeStatusModal: () => void;

    /** все формы, сгруппированные по main_widget_id */
    formsByWidget: Record<number, {
        form_id: number; name: string; main_widget_id: number;
    }>;

    /** открыть форму (Main -> TableColumn) */
    openForm: (widgetId: number, formId: number) => void;
}

export const SideNav: React.FC<Props> = ({
                                             open, toggle, formsByWidget, openForm,
                                         }) => {
    const formEntries = Object.values(formsByWidget);

    return (
        <aside className={`${s.nav} ${open ? s.open : ''}`}>
            {/* кнопка-бургер */}
            <button className={s.toggle} onClick={toggle}>☰</button>

            {/* ——— список форм ——— */}
            {formEntries.length > 0 && (
                <div>
                    <ul className={s.formsList}>
                        {formEntries.map(f => (
                            <li key={f.form_id}>
                                <button
                                    className={s.formBtn}
                                    title={f.name}
                                    onClick={() => openForm(f.main_widget_id, f.form_id)}
                                 >
                                    {/* одна структура для open / closed */}
                                    <FormaIcon className={s.icon}/>
                                    <span className={s.formName}>{f.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>

                </div>
            )}
        </aside>
    );
};
