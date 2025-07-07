import React, { useEffect } from 'react';
import { useForm } from '@/shared/hooks/useForm';

type Props = {
    formId: number;
    selectedForm:any;
    columns: any
    rows:any

};

export const PageIsVisible = ({ formId,selectedForm,columns,rows }: Props) => {



    return (
        <div>
            {selectedForm && <h2>{selectedForm.name}</h2>}

            <table>
                <thead>
                <tr>
                    {columns.map(col => (
                        <th key={col.column_order}>{col.column_name}</th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {rows.map((row, i) => (
                    <tr key={i}>
                        {row.values.map((value, j) => (
                            <td key={j}>{value ?? '-'}</td>
                        ))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};
