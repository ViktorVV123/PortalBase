import React, {useState} from 'react';
import {DTable} from "@/shared/hooks/useWorkSpaces";
import {Button, Typography} from "@mui/material";
import {ModalEditTableMeta} from "@/components/modals/modalEditTableMeta/ModalEditTableMeta";
import Editicon from "@/assets/image/EditIcon.svg";
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import AddIcon from "@mui/icons-material/AddBox";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";

type Props = {
    selectedTable: DTable | null;
    updateTableMeta: (id: number, patch: Partial<DTable>) => void;
    publishTable:(id: number) =>void
    isAdding:any
    startAdd:any
    savingNew:any
    cancelAdd:any
};


export const TableListView: React.FC<Props> = ({selectedTable, updateTableMeta,publishTable,isAdding,startAdd,savingNew,cancelAdd}) => {
    const [openMetaModal, setOpenMetaModal] = useState(false);

    if (!selectedTable) return null;

    const handleSave = async (patch: Partial<DTable>) => {
        await updateTableMeta(selectedTable.id, patch);
    };

    const handlePublish = async () => {
        if (!selectedTable) return;
        try {
            await publishTable(selectedTable.id);
        } catch (e: any) {
            alert(e.message || 'Не удалось опубликовать таблицу');
        }
    };

    return (
        <div style={{marginTop: '24px', display: 'flex', alignItems: 'center', gap:15}}>

            <Typography
                onClick={() => setOpenMetaModal(true)}
                variant="h6"
                gutterBottom

                sx={{
                    display: 'inline-flex',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    color: '#8ac7ff',
                    alignItems: 'center',
                    gap: 1,


                }}
            >
                Метаданные таблицы
                <Editicon/>
            </Typography>


            {!isAdding ? (
                <AddIcon onClick={startAdd}/>
            ) : (
                <>
                    {savingNew ? 'Сохранение…' : <SaveIcon/>}
                    {/*  <button className={s.cancelBtn} onClick={cancelAdd} disabled={savingNew}>✕ Отмена</button>*/}
                    <CancelIcon onClick={cancelAdd}/>
                </>
            )}

            {selectedTable.published === true ? ( <span>

                       Опубликована:&nbsp; ✔
                </span>

            ) : <Button
                size="small"
                variant="outlined"
                sx={{
                    ml: 2,
                    borderColor: '#8f8e8e',
                    backgroundColor: '#3e3e3e',
                    color: '#fff',
                    '&:hover': {
                        backgroundColor: '#444',
                        borderColor: '#666',
                    },
                }}
                onClick={handlePublish}

            >
                Опубликовать
            </Button>  }

            {openMetaModal && (
                <ModalEditTableMeta
                    open={openMetaModal}
                    table={selectedTable}
                    onClose={() => setOpenMetaModal(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};
