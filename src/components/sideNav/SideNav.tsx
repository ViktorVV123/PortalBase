// components/sideNav/SideNav.tsx
import React from 'react';
import * as s from './SideNav.module.scss';

import FormaIcon from '@/assets/image/FormaIcon1.svg';

export type FormListItem = {
    form_id: number;
    name: string;
    main_widget_id: number;
};

interface Props {
    forms: FormListItem[];
    openForm: (widgetId: number, formId: number) => void;
}

export const SideNav: React.FC<Props> = ({ forms, openForm }) => {
    const handleClick = (widgetId: number, formId: number) => {
        openForm(widgetId, formId);
    };

    return (
        <aside >
            <div >
                <span >Формы</span>
            </div>

            {forms.length === 0 ? (
                <div>У вас нет доступных форм</div>
            ) : (
                <ul >
                    {forms.map((f) => (
                        <li key={f.form_id} >
                            <button
                                type="button"

                                onClick={() => handleClick(f.main_widget_id, f.form_id)}
                            >
                                <FormaIcon  />
                                <span className={s.name}>{f.name}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
};
