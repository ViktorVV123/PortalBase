import { useState } from 'react';
import { api } from '@/services/api';
import { Connection } from '@/types/typesConnection';
import AddIcon from '@/assets/image/AddIcon.svg';
import * as s from './ModalAddWorkspace.module.scss';
import * as base from '@/assets/color/ModalBase.module.scss';        // базовые стили

interface Props {
    connections: Connection[];
    onSuccess: () => void;
    onCancel: () => void;
    setShowConnForm: (v: boolean) => void;
}

export const ModalAddWorkspace = ({
                                      connections, onSuccess, onCancel, setShowConnForm,
                                  }: Props) => {

    const [form, setForm] = useState({
        connection_id: connections[0]?.id ?? 0,
        group: '',
        name: '',
        description: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await api.post('/workspaces/', form);
            onSuccess();
        } catch {
            setError('Не удалось создать Workspace');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={base.backdrop}>
            <form onSubmit={submit} className={base.modal}>
                <h4>Создать Workspace</h4>

                {/* SELECT подключения */}
                <label>
                    Подключение
                    <span
                        className={s.addConnBtn}
                        onClick={() => setShowConnForm(true)}
                    >
                     <AddIcon/>
             добавить коннектор
          </span>
                    <select
                        name="connection_id"
                        value={form.connection_id}
                        onChange={handle}
                        required
                    >
                        {connections.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name} (id:{c.id})
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Группа
                    <input
                        name="group"
                        value={form.group}
                        onChange={handle}
                        required
                    />
                </label>

                <label>
                    Название
                    <input
                        name="name"
                        value={form.name}
                        onChange={handle}
                        required
                    />
                </label>

                <label>
                    Описание
                    <textarea
                        name="description"
                        value={form.description}
                        onChange={handle}
                        required
                    />
                </label>

                {error && <p style={{ color: '#e00', margin: '4px 0' }}>{error}</p>}

                <div className={base.actions}>
                    <button type="button" onClick={onCancel}>Отмена</button>
                    <button type="submit" disabled={loading || !form.name.trim()}>
                        {loading ? 'Создаю…' : 'Создать'}
                    </button>
                </div>
            </form>
        </div>
    );
};
