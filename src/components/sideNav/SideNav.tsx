// components/sideNav/SideNav.tsx
import React, { useEffect, useRef } from 'react';
import * as s from './SideNav.module.scss';

import MenuIcon from '@/assets/image/FormaIcon1.svg';
import FormaIcon from '@/assets/image/FormaIcon1.svg';

export type FormListItem = {
    form_id: number;
    name: string;
    main_widget_id: number;
};

interface Props {
    open: boolean;
    toggle: () => void;
    forms: FormListItem[];
    openForm: (widgetId: number, formId: number) => void;
}

export const SideNav: React.FC<Props> = ({ open, toggle, forms, openForm }) => {
    const wrapRef = useRef<HTMLDivElement | null>(null);


    /** Закрытие при клике вне блока + по Escape */
    useEffect(() => {
        if (!open) return;

        const handleClickAway = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node | null;
            if (!wrapRef.current || !target) return;
            if (!wrapRef.current.contains(target)) {
                toggle();
            }
        };

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                toggle();
            }
        };

        document.addEventListener('mousedown', handleClickAway);
        document.addEventListener('touchstart', handleClickAway, { passive: true });
        document.addEventListener('keydown', handleKey);

        return () => {
            document.removeEventListener('mousedown', handleClickAway);
            document.removeEventListener('touchstart', handleClickAway);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open, toggle]);

    /** Возврат фокуса на кнопку после закрытия */


    return (
        <div className={s.wrap} ref={wrapRef}>
            <div
                className={s.burger}
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <MenuIcon />
            </div>

            {open && forms.length > 0 && (
                <div className={s.popup}>
                    <ul>
                        {forms.map((f) => {
                            const handleClick = () => {
                                openForm(f.main_widget_id, f.form_id);
                                toggle();
                            };
                            return (
                                <li key={f.form_id}>
                                    <button onClick={handleClick}>
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
