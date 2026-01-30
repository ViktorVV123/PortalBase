// src/components/Form/mainTable/LoadMoreIndicator.tsx

import React from 'react';

type Props = {
    isLoading: boolean;
    hasMore: boolean;
    loadedCount: number;
    totalCount: number;
};

/**
 * Красивый индикатор загрузки для infinite scroll
 */
export const LoadMoreIndicator: React.FC<Props> = ({
                                                       isLoading,
                                                       hasMore,
                                                       loadedCount,
                                                       totalCount,
                                                   }) => {
    // Не показываем если нечего загружать и не загружаем
    if (!isLoading && !hasMore) {
        return null;
    }

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '20px 16px',
                background: 'transparent',
            }}
        >
            {isLoading ? (
                <>
                    {/* Красивый крутящийся спиннер */}
                    <div
                        style={{
                            width: '24px',
                            height: '24px',
                            border: '3px solid rgba(144, 202, 249, 0.2)',
                            borderTop: '3px solid #90caf9',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                        }}
                    />
                    <span
                        style={{
                            color: 'rgba(255, 255, 255, 0.8)',
                            fontSize: '13px',
                            fontWeight: 500,
                        }}
                    >
                        Загрузка...
                    </span>

                    {/* CSS анимация */}
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </>
            ) : hasMore ? (
                <>
                    {/* Три пульсирующие точки когда можно загрузить ещё */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(144, 202, 249, 0.6)',
                                    animation: `pulse 1.4s ease-in-out infinite`,
                                    animationDelay: `${i * 0.15}s`,
                                }}
                            />
                        ))}
                    </div>
                    <span
                        style={{
                            color: 'rgba(255, 255, 255, 0.5)',
                            fontSize: '12px',
                        }}
                    >
                        Прокрутите вниз
                    </span>

                    {/* CSS анимация для точек */}
                    <style>{`
                        @keyframes pulse {
                            0%, 80%, 100% {
                                opacity: 0.4;
                                transform: scale(0.8);
                            }
                            40% {
                                opacity: 1;
                                transform: scale(1.2);
                            }
                        }
                    `}</style>
                </>
            ) : null}
        </div>
    );
};