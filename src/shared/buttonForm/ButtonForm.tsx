// ButtonForm.tsx
import React from 'react';
import AddIcon from '@mui/icons-material/Add';
import DoneIcon from '@mui/icons-material/Done';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

type Props = {
    isAdding: boolean;
    selectedFormId: number | null;
    selectedWidget: any;
    saving: boolean;
    startAdd: () => void;
    submitAdd: () => void;
    cancelAdd: () => void;

    // для sub-режима
    showSubActions?: boolean;

    buttonClassName?: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG: Включить/выключить логирование
// ═══════════════════════════════════════════════════════════════════════════════
const DEBUG = true;

function logAction(action: string, data: Record<string, any>) {
    if (!DEBUG) return;
    console.log(
        `%c[ButtonForm] %c${action}`,
        'color: #4CAF50; font-weight: bold',
        'color: #2196F3',
        data
    );
}

export const ButtonForm: React.FC<Props> = ({
                                                isAdding,
                                                selectedFormId,
                                                selectedWidget,
                                                saving,
                                                startAdd,
                                                submitAdd,
                                                cancelAdd,
                                                showSubActions = false,
                                                buttonClassName,
                                            }) => {
    const hasMainContext = Boolean(selectedFormId || selectedWidget);
    const canAdd = showSubActions ? true : hasMainContext;
    const disableAdd = saving || !canAdd;

    const AddIconToUse = showSubActions ? AddCircleOutlineIcon : AddIcon;

    // ═══════════════════════════════════════════════════════════════════════════
    // DEBUG: Логируем состояние при каждом рендере
    // ═══════════════════════════════════════════════════════════════════════════
    if (DEBUG) {
        console.log(
            `%c[ButtonForm] %cRENDER`,
            'color: #4CAF50; font-weight: bold',
            'color: #9E9E9E',
            {
                isAdding,
                selectedFormId,
                selectedWidgetId: selectedWidget?.id,
                saving,
                hasMainContext,
                canAdd,
                disableAdd,
                showSubActions,
                // Проверяем что функции переданы
                hasStartAdd: typeof startAdd === 'function',
                hasSubmitAdd: typeof submitAdd === 'function',
                hasCancelAdd: typeof cancelAdd === 'function',
            }
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Обёртки с логированием
    // ═══════════════════════════════════════════════════════════════════════════
    const handleStartAdd = (e: React.MouseEvent) => {
        e.stopPropagation();

        logAction('CLICK: startAdd', {
            disableAdd,
            saving,
            canAdd,
            selectedFormId,
            selectedWidgetId: selectedWidget?.id,
            isFunction: typeof startAdd === 'function',
        });

        if (disableAdd) {
            logAction('BLOCKED: startAdd disabled', { reason: saving ? 'saving' : 'canAdd=false' });
            return;
        }

        if (typeof startAdd !== 'function') {
            console.error('[ButtonForm] startAdd is not a function!', startAdd);
            return;
        }

        logAction('CALLING: startAdd()', {});
        try {
            startAdd();
            logAction('SUCCESS: startAdd() called', {});
        } catch (err) {
            console.error('[ButtonForm] startAdd() threw error:', err);
        }
    };

    const handleSubmitAdd = (e: React.MouseEvent) => {
        e.stopPropagation();

        logAction('CLICK: submitAdd', { saving, isFunction: typeof submitAdd === 'function' });

        if (saving) {
            logAction('BLOCKED: submitAdd - saving in progress', {});
            return;
        }

        if (typeof submitAdd !== 'function') {
            console.error('[ButtonForm] submitAdd is not a function!', submitAdd);
            return;
        }

        logAction('CALLING: submitAdd()', {});
        try {
            submitAdd();
            logAction('SUCCESS: submitAdd() called', {});
        } catch (err) {
            console.error('[ButtonForm] submitAdd() threw error:', err);
        }
    };

    const handleCancelAdd = (e: React.MouseEvent) => {
        e.stopPropagation();

        logAction('CLICK: cancelAdd', { saving, isFunction: typeof cancelAdd === 'function' });

        if (saving) {
            logAction('BLOCKED: cancelAdd - saving in progress', {});
            return;
        }

        if (typeof cancelAdd !== 'function') {
            console.error('[ButtonForm] cancelAdd is not a function!', cancelAdd);
            return;
        }

        logAction('CALLING: cancelAdd()', {});
        try {
            cancelAdd();
            logAction('SUCCESS: cancelAdd() called', {});
        } catch (err) {
            console.error('[ButtonForm] cancelAdd() threw error:', err);
        }
    };

    if (!isAdding) {
        return (
            <button
                type="button"
                className={buttonClassName}
                disabled={disableAdd}
                onClick={handleStartAdd}
                title={showSubActions
                    ? 'Добавить запись в подтаблицу'
                    : 'Добавить запись'
                }
            >
                <AddIconToUse />
            </button>
        );
    }

    return (
        <>
            <button
                type="button"
                className={buttonClassName}
                disabled={saving}
                onClick={handleSubmitAdd}
                title={showSubActions
                    ? 'Сохранить запись подтаблицы'
                    : 'Сохранить запись'
                }
            >
                <DoneIcon />
            </button>
            <button
                type="button"
                className={buttonClassName}
                disabled={saving}
                onClick={handleCancelAdd}
                title="Отменить"
            >
                <CloseIcon />
            </button>
        </>
    );
};