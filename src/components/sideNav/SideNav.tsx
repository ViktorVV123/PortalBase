// components/sideNav/SideNav.tsx
import React from 'react';
import * as s from './SideNav.module.scss';

import MenuIcon from '@/assets/image/FormaIcon1.svg';
import FormaIcon from '@/assets/image/FormaIcon1.svg';

// Можно вынести в общий тип, если он у тебя уже есть (напр. WidgetForm)
export type FormListItem = {
    form_id: number;
    name: string;
    main_widget_id: number;
};

interface Props {
    open: boolean;
    toggle: () => void;

    // список всех форм для меню
    forms: FormListItem[];

    // formsByWidget тут не используется — можно убрать из пропсов;
    // если всё же нужно оставить, типизируй так:
    // formsByWidget?: Record<number, FormListItem>;

    openForm: (widgetId: number, formId: number) => void;
}

export const SideNav: React.FC<Props> = ({ open, toggle, forms, openForm }) => {
    return (
        <div className={s.wrap}>
            <button className={s.burger} onClick={toggle}>
                <MenuIcon className={s.icon} color="white" width={25} height={25} />
            </button>

            {open && forms.length > 0 && (
                <div className={s.popup}>
                    <ul>
                        {forms.map((f) => {
                            const handleOnclick = () => {
                                openForm(f.main_widget_id, f.form_id);
                                toggle();
                            };
                            return (
                                <li key={f.form_id}>
                                    <button onClick={handleOnclick}>
                                        <FormaIcon className={s.icon} />
                                        <span className={s.name}>{f.name}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};
