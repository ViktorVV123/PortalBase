// components/headerComponent/TopComponent.tsx
import React, {useState} from 'react';
import * as s from './TopComponent.module.scss'
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import {DTable} from '@/shared/hooks/useWorkSpaces';

type Props = {
    workSpaces: WorkSpaceTypes[];
    tablesByWs: Record<number, DTable[]>;
    loadTables: (wsId: number) => void;
    onSelectTable: (table: DTable) => void;        // ← стало
};

export const TopComponent = ({
                                 workSpaces,
                                 tablesByWs,
                                 loadTables,
                                 onSelectTable
                             }: Props) => {
    const [open, setOpen] = useState(false);
    const [hoverId, setHoverId] = useState<number | null>(null);

    return (
        <div className={s.bar}>
            <div className={s.logo}>Портал ввода данных</div>

            <div className={s.menuWrapper}>
                <button className={s.trigger} onClick={() => setOpen(o => !o)}>
                    Рабочие&nbsp;пространства▾
                </button>

                {open && (
                    <ul className={s.menuLv2}>
                        {workSpaces.map(ws => (
                            <li
                                key={ws.id}
                                onMouseEnter={async () => {
                                    setHoverId(ws.id);
                                    await loadTables(ws.id);
                                }}
                                onMouseLeave={() => setHoverId(null)}
                            >
                                {ws.name}

                                {hoverId === ws.id && tablesByWs[ws.id] && (
                                    <ul className={s.menuLv3}>
                                        {tablesByWs[ws.id].length === 0 && (
                                            <li className={s.empty}>— таблиц нет —</li>
                                        )}
                                        {tablesByWs[ws.id].map(t => (
                                            <li onClick={() => onSelectTable(t)}   key={t.id}>
                                                <strong>Таблица: </strong>
                                                {t.name}

                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
