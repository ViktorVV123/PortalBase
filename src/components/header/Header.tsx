import React, {useState} from 'react';
import * as styles from './Header.module.scss';
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import {Connection} from '@/types/typesConnection';
import DropDownList from '@/components/dropDownList/DropDownList';

type HeaderProps = {
    workSpaces: WorkSpaceTypes[];
    selectedConnection: Connection | null;
    handleWorkspaceClick: (connectionId: number) => void;
    onAddClick: () => void;
    setOpen: (value: boolean) => void;
    open: boolean;
};


const Header = ({
                    workSpaces,
                    selectedConnection,
                    handleWorkspaceClick,
                    onAddClick,
                    setOpen,
                    open
                }: HeaderProps) => {


    return (
        <header className={styles.container}>
            <div
                className={styles.title}
                onClick={() => setOpen(prev => !prev)}
            >
                Рабочее пространство
                <span
                    className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
                >
          ▼
        </span>
            </div>

            {open && (
                <div className={styles.dropdown}>
                    <DropDownList
                        workSpaces={workSpaces}
                        selectedConnection={selectedConnection}
                        handleWorkspaceClick={handleWorkspaceClick}
                        onAddClick={onAddClick}
                    />
                </div>
            )}
        </header>
    );
};

export default Header;
