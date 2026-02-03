// src/components/Form/mainTable/ResizeHandle.tsx

import React, { useCallback } from 'react';
import styles from './ResizeHandle.module.scss';

type Props = {
    colKey: string;
    onStartResize: (colKey: string, startX: number, currentWidth: number) => void;
    currentWidth: number;
};

/**
 * Ручка для ресайза колонки (как в Excel).
 * Появляется на правом крае заголовка колонки.
 */
export const ResizeHandle: React.FC<Props> = ({ colKey, onStartResize, currentWidth }) => {
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            onStartResize(colKey, e.clientX, currentWidth);
        },
        [colKey, onStartResize, currentWidth]
    );

    return (
        <div
            className={styles.resizeHandle}
            onMouseDown={handleMouseDown}
            title="Изменить ширину колонки"
        />
    );
};