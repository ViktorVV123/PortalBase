// components/sideNav/sideNav.tsx
import React from 'react';
import * as s from './SideNav.module.scss';

import HomeIcon from '@/assets/image/EditIcon.svg';
import LayersIcon from '@/assets/image/EditIcon.svg';
import PlugIcon from '@/assets/image/EditIcon.svg';
import SettingsIcon from '@/assets/image/EditIcon.svg';

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
    page: number
    setPage: (value: number) => void;
}

export const SideNav = ({open, page, toggle, setPage}: Props) => (
    <aside className={`${s.nav} ${open ? s.open : ''}`}>

        <button className={s.toggle} onClick={toggle}>☰</button>


        <div onClick={() => setPage(0)} className={page === 0 ? `${s.active} ${s.item}` : `${s.item}`}>
            <HomeIcon className={s.icon}/>
            {open && <span>Visible</span>}
        </div>
        <div onClick={() => setPage(1)} className={page === 1 ? `${s.active} ${s.item} ` : `${s.item}`}>
            <HomeIcon className={s.icon}/>
            {open && <span>NotVisible</span>}
        </div>


    </aside>
);
