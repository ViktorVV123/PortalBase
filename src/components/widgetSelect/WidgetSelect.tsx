// components/WidgetSelect/WidgetSelect.tsx
import React, { useState } from 'react';
import * as s from './WidgetSelect.module.scss';

import { Widget} from "@/shared/hooks/useWorkSpaces";


type Props = {
    widgets : Widget[];
    loading : boolean;
    error   : string|null;
    handleSelectWidget: (w: Widget)=>void;
    selectedWidget:Widget | null;
    setSelectedWidget: (w: Widget | null) => void;
};

export const WidgetSelect: React.FC<Props> = ({ widgets, loading, error,handleSelectWidget,selectedWidget,setSelectedWidget }) => {
    const [open, setOpen]             = useState(false);


    return (
        <div className={s.wrapper}>
            <button
                className={s.trigger}
                disabled={loading || !!error}
                onClick={() => setOpen(o => !o)}
            >
                {selectedWidget ? selectedWidget.name : 'Виджеты'} ▾
            </button>

            {open && (
                <ul className={s.menu}>
                    {loading      && <li className={s.dim}>Загрузка…</li>}
                    {error        && <li className={s.err}>{error}</li>}
                    {widgets.length === 0 && !loading && !error && (
                        <li className={s.dim}>— нет виджетов —</li>
                    )}
                    {widgets.map(w => (
                        <li
                            key={w.id}
                            onClick={() => { setSelectedWidget(w); setOpen(false); handleSelectWidget(w); }}
                        >
                            {w.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
