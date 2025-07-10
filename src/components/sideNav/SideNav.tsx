// components/sideNav/sideNav.tsx
import React from 'react';
import * as s from './SideNav.module.scss';

import HomeIcon from '@/assets/image/EditIcon.svg';
import LayersIcon from '@/assets/image/EditIcon.svg';
import PlugIcon from '@/assets/image/EditIcon.svg';
import SettingsIcon from '@/assets/image/EditIcon.svg';
import AddIcon from '@/assets/image/AddIcon.svg';

interface Item {
    id: string;
    label: string;
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const items: Item[] = [
    {id: 'home', label: 'Dashboard', Icon: HomeIcon},
    {id: 'workspaces', label: 'Workspaces', Icon: LayersIcon},
    {id: 'connections', label: 'Connections', Icon: PlugIcon},
    {id: 'settings', label: 'Settings', Icon: SettingsIcon},
];

interface Props {
    open: boolean;
    toggle: () => void;
    changeStatusModal:any

}

export const SideNav = ({open, toggle,changeStatusModal}: Props) => (
    <aside className={`${s.nav} ${open ? s.open : ''}`}>

        <button className={s.toggle} onClick={toggle}>☰</button>


        <div onClick={changeStatusModal} className={s.item}>
            <AddIcon className={s.icon}/>
            {open && <span>Создать workspace</span>}
        </div>
        <div  className={s.item}>
            <AddIcon className={s.icon}/>
            {open && <span>Создать Форму</span>}
        </div>
        <div className={s.item}>
            <HomeIcon className={s.icon}/>
            {open && <span>NotVisible</span>}
        </div>


    </aside>
);