import React from 'react';
import AddIcon from '@mui/icons-material/AddBox';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import AddBox from '@mui/icons-material/AddToPhotos';

type ButtonFormProps = {
    isAdding: boolean;
    startAdd: () => void;
    selectedFormId?: number | null;
    selectedWidget: any;
    submitAdd: () => void;
    saving: boolean;
    cancelAdd: () => void;

    /** передаём класс круглой кнопки из тулбара */
    buttonClassName?: string;
    showSubActions?:boolean;
};

export const ButtonForm: React.FC<ButtonFormProps> = ({
                                                          isAdding,showSubActions, startAdd, selectedFormId, selectedWidget, submitAdd, saving, cancelAdd, buttonClassName
                                                      }) => {
    const disabled = !selectedFormId || !selectedWidget;

    if (!isAdding) {
        return (
            <button
                className={buttonClassName}
                onClick={startAdd}
                disabled={disabled}
                title={disabled ? 'Выбери форму и виджет' : 'Добавить строку'}
            >
                {showSubActions ? <AddBox/>  : <AddIcon/>    }

            </button>
        );
    }

    return (
        <div style={{ display: 'inline-flex', gap: 8 }}>
            <button
                className={buttonClassName}
                onClick={submitAdd}
                disabled={saving}
                title="Сохранить"
            >
                <SaveIcon/>
            </button>
            <button
                className={buttonClassName}
                onClick={cancelAdd}
                disabled={saving}
                title="Отменить"
            >
                <CancelIcon/>
            </button>
        </div>
    );
};
