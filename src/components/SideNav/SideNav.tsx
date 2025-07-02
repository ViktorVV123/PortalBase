// components/sideNav/SideNav.tsx
import React from 'react';
import * as s from './SideNav.module.scss';

import HomeIcon     from '@/assets/image/EditIcon.svg';
import LayersIcon   from '@/assets/image/EditIcon.svg';
import PlugIcon     from '@/assets/image/EditIcon.svg';
import SettingsIcon from '@/assets/image/EditIcon.svg';

interface Item {
    id: string;
    label: string;
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const items: Item[] = [
    { id: 'home',       label: 'Dashboard',  Icon: HomeIcon },
    { id: 'workspaces', label: 'Workspaces', Icon: LayersIcon },
    { id: 'connections',label: 'Connections',Icon: PlugIcon },
    { id: 'settings',   label: 'Settings',   Icon: SettingsIcon },
];

interface Props {
    open: boolean;
    toggle: () => void;
}
export const SideNav: React.FC<Props> = ({ open, toggle }) => (
    <aside className={`${s.nav} ${open ? s.open : ''}`}>
        <button className={s.toggle} onClick={toggle}>☰</button>

        {items.map(({ id, label, Icon }) => (
            <div key={id} className={s.item}>
                <Icon className={s.icon} />
                {open && <span>{label}</span>}
            </div>
        ))}
    </aside>
);
