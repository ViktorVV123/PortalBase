import React from 'react';
import * as s from "@/components/tableColumn/TableColumn.module.scss";
import {FormDisplay} from "@/shared/hooks/useWorkSpaces";


type FormTableProps = {
    formDisplay: FormDisplay | null;
}

export const FormTable = ({formDisplay}:FormTableProps) => {
    return (
        <div>
            <table className={s.tbl}>
                <thead>
                <tr>{formDisplay.columns.map(c => <th key={c.column_name}>{c.column_name}</th>)}</tr>
                </thead>
                <tbody>
                {formDisplay.data.map((r, i) => (
                    <tr key={i}>{r.values.map((v, j) => <td key={j}>{v}</td>)}</tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};

