import React from 'react';
import AddIcon from '@mui/icons-material/AddBox';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import AddBox from '@mui/icons-material/AddToPhotos';

type ButtonFormProps = {
    isAdding: boolean;
    startAdd: () => void;
    selectedFormId?: number | null;
    selectedWidget?: any;              // ← сделаем опциональным
    submitAdd: () => void;
    saving: boolean;
    cancelAdd: () => void;

    /** передаём класс круглой кнопки из тулбара */
    buttonClassName?: string;
    /** true → это «саб»-кнопки (вторая группа в тулбаре) */
    showSubActions?: boolean;
};

export const ButtonForm: React.FC<ButtonFormProps> = ({
                                                          isAdding,
                                                          showSubActions,
                                                          startAdd,
                                                          selectedFormId,
                                                          selectedWidget,
                                                          submitAdd,
                                                          saving,
                                                          cancelAdd,
                                                          buttonClassName
                                                      }) => {
    // Для main (showSubActions=false) — не блокируем кнопку "Добавить" вообще.
    // Для sub (showSubActions=true) — оставляем старую проверку.
    const startDisabled = showSubActions ? (!selectedFormId || !selectedWidget) : false;

    if (!isAdding) {
        return (
            <button
                type="button"
                className={buttonClassName}
                onClick={startAdd}
                disabled={startDisabled}
                title={
                    startDisabled
                        ? 'Выбери форму и виджет'
                        : (showSubActions ? 'Добавить запись в подформу' : 'Добавить запись')
                }
            >
                {showSubActions ? <AddBox/> : <AddIcon/>}
            </button>
        );
    }

    return (
        <div style={{ display: 'inline-flex', gap: 8 }}>
            <button
                type="button"
                className={buttonClassName}
                onClick={submitAdd}
                disabled={saving}             // блокируем только на сохранении
                title="Сохранить"
            >
                <SaveIcon/>
            </button>
            <button
                type="button"
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
