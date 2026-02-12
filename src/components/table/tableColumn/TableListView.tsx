import React, {useState} from 'react';
import {Column, DTable} from "@/shared/hooks/useWorkSpaces";
import {Button, Typography} from "@mui/material";
import {ModalEditTableMeta} from "@/components/modals/modalEditTableMeta/ModalEditTableMeta";
import Editicon from "@/assets/image/EditIcon.svg";
import AddIcon from "@mui/icons-material/AddBox";

type Props = {
    selectedTable: DTable | null;
    updateTableMeta: (id: number, patch: Partial<DTable>) => void;
    publishTable:(id: number) =>void
    isAdding:any
    startAdd:any
    savingNew:any
    cancelAdd:any
    columns: Column[];
};


export const TableListView: React.FC<Props> = ({selectedTable, updateTableMeta,publishTable,isAdding,startAdd,savingNew,cancelAdd,columns}) => {
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
        <div style={{marginTop: '24px', display: 'flex', flexDirection: 'column', gap: 12}}>
            {/* ═══════════════════════════════════════════════════════════
                Название таблицы
            ═══════════════════════════════════════════════════════════ */}
            <div>
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 600,
                        color: 'var(--theme-text-primary)',
                        marginBottom: '4px',
                    }}
                    title={selectedTable.name}
                >
                    {selectedTable.name}
                </Typography>

            </div>

            {/* ═══════════════════════════════════════════════════════════
                Панель действий
            ═══════════════════════════════════════════════════════════ */}
            <div style={{display: 'flex', alignItems: 'center', gap: 15}}>
                <Typography
                    onClick={() => setOpenMetaModal(true)}
                    variant="body2"
                    sx={{
                        display: 'inline-flex',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        color: 'var(--link-color)',
                        alignItems: 'center',
                        gap: 1,
                        fontSize: '14px',
                        margin: 0,
                        '&:hover': {
                            color: 'var(--link-hover)',
                        },
                    }}
                >
                    Метаданные таблицы
                    <Editicon/>
                </Typography>


                {!isAdding ? (
                    <AddIcon
                        onClick={startAdd}
                        titleAccess="Добавить столбец"
                        sx={{
                            color: 'var(--icon-primary)',
                            cursor: 'pointer',
                            '&:hover': {
                                color: 'var(--theme-primary)',
                            },
                        }}
                    />
                ) : null}

                {selectedTable.published === true ? (
                    <span style={{ color: 'var(--theme-success)', fontSize: '14px' }}>
                        Опубликована ✔
                    </span>
                ) : (
                    <Button
                        size="small"
                        variant="outlined"
                        sx={{
                            borderColor: 'var(--button-secondary-border)',
                            backgroundColor: 'var(--theme-surface)',
                            color: 'var(--theme-text-primary)',
                            fontSize: '12px',
                            '&:hover': {
                                backgroundColor: 'var(--theme-hover)',
                                borderColor: 'var(--input-border-hover)',
                            },
                        }}
                        onClick={handlePublish}
                    >
                        Опубликовать
                    </Button>
                )}
            </div>

            {openMetaModal && (
                <ModalEditTableMeta
                    open={openMetaModal}
                    table={selectedTable}
                    columns={columns}
                    onClose={() => setOpenMetaModal(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};