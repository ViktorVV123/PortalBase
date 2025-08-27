import React from 'react';
import {Button, Fab} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';

type ButtonFormProps = {
    isAdding: any,
    startAdd: any,
    selectedFormId?: any,
    selectedWidget: any, submitAdd: any,
    saving: any
    cancelAdd: any
}

export const ButtonForm = ({
                               isAdding,
                               startAdd,
                               selectedFormId,
                               selectedWidget,
                               submitAdd,
                               saving,
                               cancelAdd
                           }: ButtonFormProps) => {
    return (
        <>
            {!isAdding ? (
                <Fab size={"small"} onClick={startAdd}
                     disabled={!selectedFormId || !selectedWidget}
                     title={!selectedFormId || !selectedWidget ? 'Выбери форму и виджет' : 'Добавить строку'}>
                    <AddIcon/>
                </Fab>

            ) : (
                <div style={{display: "flex", gap:10}}>
                    <Fab size="small"
                         onClick={submitAdd}
                         disabled={saving}>
                        <SaveIcon/>
                    </Fab>
                  {/*  <Button
                    >
                        {saving ? 'Сохранение…' : 'Сохранить'}
                    </Button>*/}
                    <Fab  size="small"
                          onClick={cancelAdd}
                          disabled={saving}>
                        <CancelIcon/>
                    </Fab>


                </div>
            )}
        </>
    );
};

