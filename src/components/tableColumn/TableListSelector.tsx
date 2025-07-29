import React, { useEffect, useState } from 'react';

import * as s from './Table.module.scss';
import {DTable} from "@/shared/hooks/useWorkSpaces";

type Props = {
    selectedTable:DTable | null;
    updateTableMeta:(id: number, patch: Partial<DTable>) => void;
};

export const TableListView: React.FC<Props> = ({selectedTable,updateTableMeta  }:Props) => {

    const [isEditingMeta, setIsEditingMeta] = useState(false);
    const [metaDraft, setMetaDraft] = useState<Partial<DTable>>({});

    const handleMetaChange = (field: keyof DTable, value: string) => {
        setMetaDraft(prev => ({ ...prev, [field]: value }));
    };

    const saveMeta = async () => {
        if (!selectedTable) return;
        await updateTableMeta(selectedTable.id, metaDraft);
        setIsEditingMeta(false);
    };


    return (
        <div>
            {selectedTable && (
                <div className={s.tableMeta}>
                    <h4>Метаданные таблицы</h4>

                    {isEditingMeta ? (
                        <>
                            <label>
                                Название:
                                <input
                                    className={s.inp}
                                    value={metaDraft.name ?? selectedTable.name}
                                    onChange={e => handleMetaChange('name', e.target.value)}
                                />
                            </label>

                            <label>
                                Описание:
                                <input
                                    className={s.inp}
                                    value={metaDraft.description ?? selectedTable.description ?? ''}
                                    onChange={e => handleMetaChange('description', e.target.value)}
                                />
                            </label>

                            <label>
                                SELECT:
                                <textarea
                                    className={s.codeArea}
                                    value={metaDraft.select_query ?? selectedTable.select_query ?? ''}
                                    onChange={e => handleMetaChange('select_query', e.target.value)}
                                />
                            </label>

                            <label>
                                INSERT:
                                <textarea
                                    className={s.codeArea}
                                    value={metaDraft.insert_query ?? selectedTable.insert_query ?? ''}
                                    onChange={e => handleMetaChange('insert_query', e.target.value)}
                                />
                            </label>

                            <label>
                                UPDATE:
                                <textarea
                                    className={s.codeArea}
                                    value={metaDraft.update_query ?? selectedTable.update_query ?? ''}
                                    onChange={e => handleMetaChange('update_query', e.target.value)}
                                />
                            </label>

                            <label>
                                DELETE:
                                <textarea
                                    className={s.codeArea}
                                    value={metaDraft.delete_query ?? selectedTable.delete_query ?? ''}
                                    onChange={e => handleMetaChange('delete_query', e.target.value)}
                                />
                            </label>

                            <div className={s.metaActions}>
                                <button className={s.okBtn} onClick={saveMeta}>✓</button>
                                <button className={s.cancelBtn} onClick={() => setIsEditingMeta(false)}>✕</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p><strong>Название:</strong> {selectedTable.name}</p>
                            <p><strong>ID:</strong> {selectedTable.id}</p>
                            <p><strong>Описание:</strong> {selectedTable.description || '—'}</p>
                            <p><strong>SELECT:</strong> <code>{selectedTable.select_query || '—'}</code></p>
                            <p><strong>INSERT:</strong> <code>{selectedTable.insert_query || '—'}</code></p>
                            <p><strong>UPDATE:</strong> <code>{selectedTable.update_query || '—'}</code></p>
                            <p><strong>DELETE:</strong> <code>{selectedTable.delete_query || '—'}</code></p>
                            <div className={s.metaActions}>
                                <button onClick={() => {
                                    setMetaDraft({});
                                    setIsEditingMeta(true);
                                }}>✎ Редактировать</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
