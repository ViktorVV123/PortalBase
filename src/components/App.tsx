// src/App.tsx
import React from 'react';
import {ErrorBoundary} from "@/components/errorBoundary/ErrorBoundary";
import {Main} from "@/pages/main/Main";
import * as styles from './App.module.scss';
import ThemeProvider from "@/shared/theme/ThemeContext";

export const App = () => {
    return (
        <ThemeProvider>
            <ErrorBoundary>
                {/* КРИТИЧНО: этот div должен блокировать скролл */}
                <div className={styles.appRoot}>
                    <Main/>
                </div>
            </ErrorBoundary>
        </ThemeProvider>
    );
};