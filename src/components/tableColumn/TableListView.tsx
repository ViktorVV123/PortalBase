import React, { useState } from 'react';
import { DTable } from "@/shared/hooks/useWorkSpaces";
import { Typography } from "@mui/material";
import { ModalEditTableMeta } from "@/components/modals/modalEditTableMeta/ModalEditTableMeta";
import Editicon from "@/assets/image/EditIcon.svg";

type Props = {
    selectedTable: DTable | null;
    updateTableMeta: (id: number, patch: Partial<DTable>) => void;
};

export const TableListView: React.FC<Props> = ({ selectedTable, updateTableMeta }) => {
    const [openMetaModal, setOpenMetaModal] = useState(false);

    if (!selectedTable) return null;

    const handleSave = async (patch: Partial<DTable>) => {
        await updateTableMeta(selectedTable.id, patch);
    };

    return (
        <div style={{ marginTop: '24px' }}>
            <Typography
                variant="h6"
                gutterBottom
                onClick={() => setOpenMetaModal(true)}
                sx={{ cursor: 'pointer', textDecoration: 'underline', color: '#8ac7ff',display:'flex', alignItems: 'center',gap:1 }}
            >
                Метаданные таблицы
                <Editicon/>
            </Typography>

            <p><strong>Название:</strong> {selectedTable.name}</p>
           {/* <p><strong>ID:</strong> {selectedTable.id}</p>*/}
            <p><strong>Описание:</strong> {selectedTable.description || '—'}</p>
            <p><strong>SELECT:</strong> <code>{selectedTable.select_query || '—'}</code></p>
            <p><strong>INSERT:</strong> <code>{selectedTable.insert_query || '—'}</code></p>
            <p><strong>UPDATE:</strong> <code>{selectedTable.update_query || '—'}</code></p>
            <p><strong>DELETE:</strong> <code>{selectedTable.delete_query || '—'}</code></p>

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
