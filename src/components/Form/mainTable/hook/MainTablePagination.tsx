// src/components/Form/mainTable/MainTablePagination.tsx

import React from 'react';
import { TablePagination, Box } from '@mui/material';
import { MAIN_TABLE_PAGE_SIZE } from '@/shared/hooks/stores/useFormsStore';

type Props = {
    currentPage: number;
    totalRows: number;
    pageSize?: number;
    onPageChange: (newPage: number) => void;
    loading?: boolean;
};

export const MainTablePagination: React.FC<Props> = ({
                                                         currentPage,
                                                         totalRows,
                                                         pageSize = MAIN_TABLE_PAGE_SIZE,
                                                         onPageChange,
                                                         loading = false,
                                                     }) => {
    // Не показываем пагинатор если данных меньше или равно размеру страницы
    if (totalRows <= pageSize) {
        return null;
    }

    const totalPages = Math.ceil(totalRows / pageSize);

    const handlePageChange = (_: unknown, newPage: number) => {
        // MUI TablePagination использует 0-based индексацию
        // Наш API использует 1-based
        onPageChange(newPage + 1);
    };

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                borderTop: '1px solid var(--theme-border)',
                backgroundColor: 'var(--theme-surface)',
                px: 1,
                py: 0.5,
                minHeight: 40,
            }}
        >
            <TablePagination
                component="div"
                count={totalRows}
                page={currentPage - 1} // MUI использует 0-based
                rowsPerPage={pageSize}
                onPageChange={handlePageChange}
                rowsPerPageOptions={[pageSize]} // Фиксированный размер страницы
                labelRowsPerPage="" // Скрываем label
                labelDisplayedRows={({ from, to, count }) =>
                    `${from}–${to} из ${count !== -1 ? count : `более ${to}`}`
                }
                disabled={loading}
                showFirstButton
                showLastButton
                sx={{
                    '& .MuiTablePagination-toolbar': {
                        minHeight: 36,
                        paddingLeft: 1,
                        paddingRight: 1,
                    },
                    '& .MuiTablePagination-selectLabel': {
                        display: 'none',
                    },
                    '& .MuiTablePagination-select': {
                        display: 'none',
                    },
                    '& .MuiTablePagination-selectIcon': {
                        display: 'none',
                    },
                    '& .MuiTablePagination-displayedRows': {
                        color: 'var(--theme-text-secondary)',
                        fontSize: '13px',
                        marginRight: 2,
                    },
                    '& .MuiTablePagination-actions': {
                        marginLeft: 1,
                        '& .MuiIconButton-root': {
                            color: 'var(--theme-text-secondary)',
                            padding: '4px',
                            '&:hover': {
                                backgroundColor: 'var(--theme-hover)',
                            },
                            '&.Mui-disabled': {
                                color: 'var(--theme-text-muted)',
                            },
                        },
                    },
                }}
            />

            {/* Дополнительная информация о страницах */}
            <Box
                sx={{
                    ml: 2,
                    color: 'var(--theme-text-muted)',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                }}
            >
                Стр. {currentPage} / {totalPages}
            </Box>
        </Box>
    );
};