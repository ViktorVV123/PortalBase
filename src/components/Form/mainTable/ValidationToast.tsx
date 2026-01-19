// src/components/Form/mainTable/ValidationToast.tsx

import React, { useEffect } from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

type ValidationToastProps = {
    open: boolean;
    onClose: () => void;
    missingFields: string[];
    /** Авто-закрытие через N мс (0 = не закрывать) */
    autoHideDuration?: number;
};

export const ValidationToast: React.FC<ValidationToastProps> = ({
                                                                    open,
                                                                    onClose,
                                                                    missingFields,
                                                                    autoHideDuration = 5000,
                                                                }) => {
    // Закрываем автоматически
    useEffect(() => {
        if (open && autoHideDuration > 0) {
            const timer = setTimeout(onClose, autoHideDuration);
            return () => clearTimeout(timer);
        }
    }, [open, autoHideDuration, onClose]);

    if (!open || missingFields.length === 0) return null;

    const message = missingFields.length === 1
        ? `Заполните обязательное поле: ${missingFields[0]}`
        : `Заполните обязательные поля: ${missingFields.join(', ')}`;

    return (
        <Snackbar
            open={open}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            sx={{ mb: 2 }}
        >
            <Alert
                severity="error"
                variant="filled"
                onClose={onClose}
                icon={<ErrorOutlineIcon />}
                sx={{
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #ef4444',
                    '& .MuiAlert-icon': {
                        color: '#ef4444',
                    },
                    '& .MuiAlert-message': {
                        color: '#fff',
                    },
                    '& .MuiAlert-action': {
                        color: 'rgba(255,255,255,0.7)',
                    },
                }}
            >
                <AlertTitle sx={{ fontWeight: 600, mb: 0.5 }}>
                    Не заполнены обязательные поля
                </AlertTitle>
                {message}
            </Alert>
        </Snackbar>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// ХЕЛПЕР: Хук для управления состоянием валидации
// ═══════════════════════════════════════════════════════════════════════════

export function useValidationToast() {
    const [showToast, setShowToast] = React.useState(false);
    const [missingFields, setMissingFields] = React.useState<string[]>([]);
    const [showErrors, setShowErrors] = React.useState(false);

    const showValidationError = React.useCallback((fields: string[]) => {
        setMissingFields(fields);
        setShowToast(true);
        setShowErrors(true); // Включаем подсветку ошибок в полях
    }, []);

    const hideValidationError = React.useCallback(() => {
        setShowToast(false);
        // Не сбрасываем showErrors — они остаются до успешной отправки
    }, []);

    const resetValidation = React.useCallback(() => {
        setShowToast(false);
        setMissingFields([]);
        setShowErrors(false);
    }, []);

    return {
        showToast,
        missingFields,
        showErrors,
        showValidationError,
        hideValidationError,
        resetValidation,
    };
}