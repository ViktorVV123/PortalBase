import {useState} from 'react';
import {api} from '@/services/api';
import {Connection} from '@/types/typesConnection';


interface Props {
    connections: Connection[];   // список для <select>
    onSuccess: () => void;
    onCancel: () => void;
    setShowConnForm: (value: boolean) => void;
}

export const CreateWorkspaceForm = ({connections, onSuccess, onCancel, setShowConnForm}: Props) => {
    // connection_id = первый в списке (если есть)
    const [form, setForm] = useState({
        connection_id: connections[0]?.id ?? 0,
        group: '',
        name: '',
        description: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const {name, value} = e.target;
        setForm(prev => ({...prev, [name]: value}));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await api.post('/workspaces/', form);
            onSuccess();                 // закрыть + обновить список
        } catch {
            setError('Не удалось создать Workspace');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{border: '1px solid #aaa', padding: 16, marginTop: 16}}>
            <h4>Создать Workspace</h4>

            <label>Подключение:</label><br/>
            <div style={{
                border: '1px solid black',
                borderRadius: 10,
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 20,
                marginTop: 10,
                cursor: 'pointer'
            }} onClick={() => setShowConnForm(true)}>Добавить коннектор +
            </div>
            <select
                name="connection_id"
                value={form.connection_id}
                onChange={handleChange}
                required
                style={{width: '100%'}}
            >
                {connections.map(c => (
                    <option key={c.id} value={c.id}>
                        {c.name} (id: {c.id})
                    </option>
                ))}
            </select><br/><br/>
            <label>Группа:</label><br/>
            <input
                name="group"
                value={form.group}
                onChange={handleChange}
                required
                style={{width: '100%'}}
            /><br/><br/>

            <label>Название:</label><br/>
            <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                style={{width: '100%'}}
            /><br/><br/>

            <label>Описание:</label><br/>
            <input
                name="description"
                value={form.description}
                onChange={handleChange}
                required
                style={{width: '100%'}}
            /><br/><br/>

            <button type="submit" disabled={loading}>
                {loading ? 'Создаю…' : 'Создать'}
            </button>
            &nbsp;
            <button type="button" onClick={onCancel}>Отмена</button>

            {error && <p style={{color: 'red'}}>{error}</p>}
        </form>
    );
};
