import React from 'react';
import cn from 'clsx';
import * as s from './Breadcrumb.module.scss';

export type Crumb = {
    label: string;
    onClick?: () => void;     // если есть — отрисуем кнопкой
    active?: boolean;         // последний сегмент
};

type Props = {
    items: Crumb[];           // workspace → table → widget → form → sub
    className?: string;
    separator?: React.ReactNode; // по умолчанию ‹→›
};

export const Breadcrumb: React.FC<Props> = React.memo(({ items, className, separator = '→' }) => {
    if (!items?.length) return null;

    return (
        <nav aria-label="breadcrumb" style={{marginBottom:10}}>
            <ol className={s.list}>
                {items.map((it, idx) => {
                    const isLast = idx === items.length - 1 || it.active;
                    return (
                        <li key={idx} className={cn(s.item, isLast && s.active)}>
                            {it.onClick && !isLast ? (
                                <button type="button" className={s.link} onClick={it.onClick}>
                                    {it.label}
                                </button>
                            ) : (
                                <span className={s.text}>{it.label}</span>
                            )}
                            {!isLast && <span className={s.sep} aria-hidden>{separator}</span>}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
});
Breadcrumb.displayName = 'Breadcrumb';
