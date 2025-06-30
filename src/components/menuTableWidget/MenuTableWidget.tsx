import React from 'react';
import * as styles from './MenuTableWidget.module.scss'

type MenuTableWidgetProps = {
    setSwapTableWidget: (value: number) => void;
    view:string
};

export const MenuTableWidget = ({ setSwapTableWidget ,view}: MenuTableWidgetProps) => (
    <div className={styles.container}>
        <h4 className={`${view === 'table' ? styles.active :''}`} onClick={() => setSwapTableWidget(0)}>Table</h4>
        <h4 className={`${view === 'widget' ? styles.active :''}`} onClick={() => setSwapTableWidget(1)}>Widget</h4>
    </div>
);
