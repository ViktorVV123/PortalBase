import React, { useState, useEffect, useRef } from 'react';
import * as styles from './Header.module.scss';
import { WorkSpaceTypes } from '@/types/typesWorkSpaces';
import { Connection } from '@/types/typesConnection';
import DropDownList from '@/components/dropDownList/DropDownList';

type HeaderProps = {
    workSpaces: WorkSpaceTypes[];

    handleWorkspaceClick: (connectionId: number) => void; // открывает детали
    onAddClickWorkspace: () => void;                               // показать форму создания WS
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const Header = ({
                    workSpaces,
                    handleWorkspaceClick,
                    onAddClickWorkspace,
                    open,
                    setOpen,
                }: HeaderProps) => {
    /** выбранный workspace (по умолчанию первый, если есть) */
    const [selected, setSelected] = useState<WorkSpaceTypes | null>(
        workSpaces[0] ?? null
    );

    /** если список workSpaces обновился (после загрузки) — взять первый */
    useEffect(() => {
        if (workSpaces.length && !selected) setSelected(workSpaces[0]);
    }, [workSpaces, selected]);

    /** клик вне блока закрывает выпадашку */
    const wrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [setOpen]);

    /** выбор workspace в списке */
    const selectWorkspace = (ws: WorkSpaceTypes) => {
        setSelected(ws);
        setOpen(false);
        handleWorkspaceClick(ws.connection_id); // connection_id нужен Main-у
    };

    return (
        <div className={styles.container} ref={wrapperRef}>
            <div className={styles.title} onClick={() => setOpen((p) => !p)}>
                {selected ? selected.name : 'Нет рабочих пространств'}
                <span
                    className={`${styles.chevron} ${
                        open ? styles.chevronOpen : ''
                    }`}
                >
          ▼
        </span>
            </div>

            {open && (
                <div className={styles.dropdown}>
                    <DropDownList
                        workSpaces={workSpaces}
                        onSelect={selectWorkspace}
                        onAddClickWorkspace={onAddClickWorkspace}
                        selectedId={selected?.id}
                    />
                </div>
            )}
        </div>
    );
};

export default Header;
