import React from 'react';
import * as styles from './Header.module.scss';
import { WorkSpaceTypes } from '@/types/typesWorkSpaces';
import { Connection } from '@/types/typesConnection';
import DropDownList from '@/components/dropDownList/DropDownList';
import {SelectedConnectionList} from "@/components/selectedConnectionList/SelectedConnectionList";


type HeaderProps = {
    workSpaces: WorkSpaceTypes[];
    deleteWorkspace:(wsId: number) => void
    onAddClickWorkspace: () => void;                               // показать форму создания WS
    open: boolean;
    updateWorkspace: (id: number, patch: Partial<Omit<WorkSpaceTypes, 'id'>>) => void;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    selectWorkspace:any
    selected:any
    wrapperRef:any
    selectedConnection: Connection | null;


};

const Header = ({
                    workSpaces,
                    selectWorkspace,
                    selected,
                    wrapperRef,
                    selectedConnection,
                    onAddClickWorkspace,
                    open,
                    setOpen,
                    deleteWorkspace,
                    updateWorkspace,

                }: HeaderProps) => {


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
                        updateWorkspace={updateWorkspace}
                        deleteWorkspace={deleteWorkspace}
                        workSpaces={workSpaces}
                        selectWorkspace={selectWorkspace}
                        onAddClickWorkspace={onAddClickWorkspace}
                        selectedId={selected?.id}
                    />
                </div>
            )}
            <SelectedConnectionList selectedConnection={selectedConnection}/>

        </div>
    );
};

export default Header;
