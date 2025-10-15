import React from 'react';
import {Button, Dialog, DialogActions, DialogContent, DialogTitle} from '@mui/material';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import type {FormDisplay} from '@/shared/hooks/useWorkSpaces';

type Props = {
    open: boolean;
    formId: number | null;
    loading: boolean;
    error?: string;
    display: FormDisplay | null;
    onClose: () => void;
};

const safe = (v?: string | null) => (v?.trim() ? v.trim() : '—');

export const DrillDialog: React.FC<Props> = ({open, formId, loading, error, display, onClose}) => (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
        <DialogTitle>Форма #{formId ?? '—'}</DialogTitle>
        <DialogContent dividers>
            {loading && <div style={{opacity: 0.7, padding: 12}}>Загрузка…</div>}
            {!!error && <div style={{color: '#f66', padding: 12}}>Ошибка: {error}</div>}

            {display && (
                <div className={s.tableScroll}>
                    <table className={s.tbl}>
                        <thead>
                        <tr>
                            {display.columns.map((c, i) => (
                                <th key={`d-col-${i}`}>{safe(c.ref_column_name ?? c.column_name)}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {display.data.map((r, ri) => (
                            <tr key={`d-row-${ri}`}>
                                {display.columns.map((_, ci) => (
                                    <td key={`d-cell-${ri}-${ci}`}>{r.values[ci] ?? ''}</td>
                                ))}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Закрыть</Button>
        </DialogActions>
    </Dialog>
);
