// src/components/Form/mainTable/MainTableLoadingOverlay.tsx

import React from 'react';
import { Box, CircularProgress, Typography, Fade } from '@mui/material';

type Props = {
    visible: boolean;
    currentPage?: number;
    totalPages?: number;
};

/**
 * Оверлей загрузки для MainTable при переключении страниц.
 * Показывает полупрозрачный фон с индикатором загрузки поверх таблицы.
 */
export const MainTableLoadingOverlay: React.FC<Props> = ({
                                                             visible,
                                                             currentPage,
                                                             totalPages,
                                                         }) => {
    if (!visible) return null;

    const showPageInfo = currentPage != null && totalPages != null && totalPages > 1;

    return (
        <Fade in={visible} timeout={150}>
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(18, 18, 18, 0.7)',
                    backdropFilter: 'blur(2px)',
                    zIndex: 10,
                    borderRadius: '4px',
                    gap: 1.5,
                }}
            >
                <CircularProgress
                    size={32}
                    thickness={4}
                    sx={{
                        color: 'var(--theme-primary, #90caf9)',
                    }}
                />

                {showPageInfo && (
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'var(--theme-text-secondary, rgba(255, 255, 255, 0.7))',
                            fontSize: '13px',
                            fontWeight: 500,
                        }}
                    >
                        Загрузка страницы {currentPage} из {totalPages}…
                    </Typography>
                )}
            </Box>
        </Fade>
    );
};