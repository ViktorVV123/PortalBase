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
    // 👉 теперь AddIcon меняется в зависимости от режима

    if (!isAdding) {
        return (
            <button
                type="button"
                className={buttonClassName}
                disabled={disableAdd}
                onClick={startAdd}
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
                onClick={submitAdd}
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
                onClick={cancelAdd}
                title="Отменить"
            >
                <CloseIcon />
            </button>
        </>
    );
};