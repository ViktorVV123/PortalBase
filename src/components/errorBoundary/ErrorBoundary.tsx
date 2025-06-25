// ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children?: ReactNode; // делаем опционально
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Ошибка в ErrorBoundary:', error, errorInfo);
        if (process.env.NODE_ENV === 'production') {
            fetch('/api/log-error', {
                method: 'POST',
                body: JSON.stringify({ error: error.message, stack: errorInfo.componentStack }),
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 20, backgroundColor: '#2D2D2D', color: '#EEEEEE', borderRadius: 5, fontSize: 20 }}>
                    <h2 style={{color:'white'}}>Произошла ошибка</h2>
                    <p>Что-то пошло не так. Попробуйте обновить страницу или обратитесь в поддержку.</p>
                </div>
            );
        }
        return this.props.children || null;
    }
}