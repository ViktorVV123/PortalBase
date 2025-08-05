import React from 'react';
import {Typography} from "@mui/material";
import Editicon from "@/assets/image/EditIcon.svg";
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import DeleteIcon from "@/assets/image/DeleteIcon.svg";
import {WidgetColumn} from "@/shared/hooks/useWorkSpaces";
import {WcReference} from "@/components/WidgetColumnsOfTable/WidgetColumnsOfTable";


type WidgetColumnsMainTableProps = {
    widgetColumns:WidgetColumn[]
    referencesMap: Record<number, WcReference[]>
    handleDeleteReference:any
}

export const WidgetColumnsMainTable = ({widgetColumns,referencesMap,handleDeleteReference}:WidgetColumnsMainTableProps) => {
    return (
        <div>
            {/* ───── блок Reference-таблиц ───── */}
            <h3 style={{ margin: '24px 0 8px' }}>References</h3>
            <Typography
                variant="h6"
                gutterBottom
                onClick={() => {}} // здесь будет ваша логика «Добавить»
                sx={{
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    color: '#8ac7ff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    width: '15%',
                }}
            >
                Добавить
                <Editicon />
            </Typography>

            {widgetColumns.map((wc) => {
                const refs = referencesMap[wc.id] ?? [];
                return (
                    <div key={`ref-${wc.id}`} style={{ marginBottom: 24 }}>
                        <h4 style={{ marginBottom: 6 }}>WidgetColumn&nbsp;{wc.id}</h4>
                        {refs.length ? (
                            <table className={s.tbl}>
                                <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Datatype</th>
                                    <th>Width</th>
                                    <th>Visible</th>
                                    <th>Primary</th>
                                    <th></th>
                                </tr>
                                </thead>
                                <tbody>
                                {refs.map((r, i) => (
                                    <tr key={i}>
                                        <td>{r.table_column.name}</td>
                                        <td>{r.table_column.datatype}</td>
                                        <td>{r.width}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {r.visible ? '✔' : ''}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {r.primary ? '✔' : ''}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <Editicon />
                                            <DeleteIcon
                                                className={s.actionIcon}
                                                onClick={() =>
                                                    handleDeleteReference(wc.id, r.table_column.id)
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        ) : (
                            <p style={{ fontStyle: 'italic', color: '#777' }}>
                                reference не найдены
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
