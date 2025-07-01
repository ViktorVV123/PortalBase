// components/modals/NewTableModal.tsx
import React, { useState } from 'react';
import * as s from './NewTableModal.module.scss';
import {TableDraft} from "@/types/tableDraft";


interface Props {
    open: boolean;
    onClose: () => void;
    onSubmit: (draft: TableDraft) => Promise<void>;
}

const empty: TableDraft = {
    name: '',
    description: '',
    select_query: '',
    insert_query: '',
    update_query: '',
    delete_query: '',
    published: false,
};

export const NewTableModal = ({ open, onClose, onSubmit }: Props) => {
    const [draft, setDraft] = useState<TableDraft>(empty);

    /** helper */
    const on = <K extends keyof TableDraft>(key: K, value: TableDraft[K]) =>
        setDraft(prev => ({ ...prev, [key]: value }));

    if (!open) return null;

    return (
        <div className={s.backdrop}>
            <div className={s.modal}>
                <h3>Новая таблица</h3>

                <label>
                    name
                    <input value={draft.name} onChange={e => on('name', e.target.value)} />
                </label>

                <label>
                    description
                    <textarea
                        value={draft.description}
                        onChange={e => on('description', e.target.value)}
                    />
                </label>

                <fieldset className={s.queries}>
                    {(['select_query', 'insert_query', 'update_query', 'delete_query'] as const).map(
                        k => (
                            <label key={k}>
                                {k.replace('_', ' ')}
                                <textarea
                                    value={draft[k]}
                                    onChange={e => on(k, e.target.value)}
                                />
                            </label>
                        ),
                    )}
                </fieldset>

                <label className={s.published}>
                    <input
                        type="checkbox"
                        checked={draft.published}
                        onChange={e => on('published', e.target.checked)}
                    />
                    published
                </label>

                <div className={s.actions}>
                    <button onClick={onClose}>Отмена</button>
                    <button
                        disabled={!draft.name.trim()}
                        onClick={async () => {
                            await onSubmit({ ...draft, name: draft.name.trim() });
                            setDraft(empty);  // очистить при успехе
                        }}
                    >
                        Создать
                    </button>
                </div>
            </div>
        </div>
    );
};
