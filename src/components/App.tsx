// src/App.tsx
import React from 'react';
import { ErrorBoundary } from "@/components/errorBoundary/ErrorBoundary";
import { Main } from "@/pages/main/Main";
import * as styles from './App.module.scss';

export const App = () => {
    return (
        <ErrorBoundary>
            {/* КРИТИЧНО: этот div должен блокировать скролл */}
            <div className={styles.appRoot}>
                <Main />
            </div>
        </ErrorBoundary>
    );
};