// components/sideNav/SideNav.tsx
import React from 'react';
import * as s from './SideNav.module.scss';

import MenuIcon from '@/assets/image/FormaIcon1.svg';
import FormaIcon from '@/assets/image/FormaIcon1.svg';


interface Props {
    open: boolean;
    toggle: () => void;

    /** все формы */
    formsByWidget: Record<number, { form_id: number; name: string; main_widget_id: number; }>;
    openForm: (widgetId: number, formId: number) => void;
}

export const SideNav: React.FC<Props> = ({open, toggle, formsByWidget, openForm}) => {
    const forms = Object.values(formsByWidget);

    return (
        <div className={s.wrap}>
            {/* бургер */}
            <button className={s.burger} onClick={toggle}>
                <MenuIcon color={'white'} width={25} height={25}/>
            </button>

            {/* выпадашка */}
            {open && forms.length > 0 && (
                <div className={s.popup}>
                    <ul>
                        {forms.map(f => {
                            const handleOnclick = () => {
                                openForm(f.main_widget_id, f.form_id)
                                toggle()
                            }
                            return (
                                <li key={f.form_id}>
                                    <button onClick={handleOnclick}>
                                        <FormaIcon/>
                                        <span className={s.name}>{f.name}</span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};
