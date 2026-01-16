import React from 'react';
import * as styles from './MenuLoader.module.scss';

type Props = {
    text?: string;
    size?: 'sm' | 'md';
};

export const MenuLoader: React.FC<Props> = ({ text = 'Загрузка...', size = 'sm' }) => {
    return (
        <div className={`${styles.loader} ${styles[size]}`}>
            <div className={styles.spinner} />
            {text && <span className={styles.text}>{text}</span>}
        </div>
    );
};