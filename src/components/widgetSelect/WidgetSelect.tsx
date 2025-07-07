// components/WidgetSelect/WidgetSelect.tsx
import React, { useState } from 'react';
import * as s from './WidgetSelect.module.scss';
import {Widget} from "@/shared/hooks/useWidget";
import {DTable} from "@/shared/hooks/useWorkSpaces";


type Props = {
    widgets : Widget[];
    loading : boolean;
    error   : string|null;
    handleSelectWidget: (w: Widget)=>void;

};

export const WidgetSelect: React.FC<Props> = ({ widgets, loading, error,handleSelectWidget }) => {
    const [open, setOpen]             = useState(false);
    const [selected, setSelected]     = useState<Widget|null>(null);

    return (
        <div className={s.wrapper}>
            <button
                className={s.trigger}
                disabled={loading || !!error}
                onClick={() => setOpen(o => !o)}
            >
                {selected ? selected.name : 'Виджеты'} ▾
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
                            onClick={() => { setSelected(w); setOpen(false); handleSelectWidget(w); }}
                        >
                            {w.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
