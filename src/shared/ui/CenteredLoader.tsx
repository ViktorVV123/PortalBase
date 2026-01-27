import React from 'react';
import { CircularProgress } from '@mui/material';
import * as s from './CenteredLoader.module.scss';

type Props = {
    /** Текст под спиннером, можно не передавать */
    label?: string;
    /** Оверлей на всю страницу/контейнер */
    fullScreen?: boolean;
};

export const CenteredLoader: React.FC<Props> = ({ label = 'Загрузка…', fullScreen }) => {
    return (
        <div className={fullScreen ? s.backdrop : s.container}>
            <div className={s.box}>
                <CircularProgress
                    sx={{
                        color: 'var(--theme-primary)',
                    }}
                />
                {label && <span className={s.text}>{label}</span>}
            </div>
        </div>
    );
};