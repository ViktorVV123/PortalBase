// components/CreateConnectionForm.tsx
import { useState } from 'react';
import { api } from '@/services/api';
import { CreateConnectionDto } from '@/types/typesCreateConnections';
import * as styles from './ModalAddConnection.module.scss'

interface Props {
    onSuccess: () => void;
    onCancel:  () => void;
}

export const ModalAddConnection = ({ onSuccess, onCancel }: Props) => {
    const [form, setForm] = useState<CreateConnectionDto>({
        url: {
            drivername: '',
            username: '',
            password: '',
            host: '',
            port: 5432,
            database: '',
            query: {},
        },
        connection: { name: '', description: '' },
    });

    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        /* имена вида url.drivername или connection.name */
        const [section, field] = name.split('.');

        setForm(prev => ({
            ...prev,
            [section]: { ...prev[section as keyof CreateConnectionDto], [field]: value },
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null);

        try {
            await api.post('/connections/sqlalchemy', form);
            onSuccess();
        } catch {
            setError('Не удалось создать подключение');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.containerModalCn}>
        <form className={styles.modalCn} onSubmit={handleSubmit}
              style={{ border: '1px solid #aaa', padding: 16, marginTop: 16, maxWidth: 500 }}>
            <h4>Создать Connection (sqlalchemy)</h4>

            {/* --- url.* --------------------------------------------------------- */}
            <fieldset style={{padding:10, marginBottom:10, border: '2px solid grey',borderRadius:10}}>
                <legend>URL-параметры</legend>

                <input name="url.drivername" placeholder="drivername"
                       value={form.url.drivername} onChange={handleChange} required /><br /><br />

                <input name="url.username" placeholder="username"
                       value={form.url.username} onChange={handleChange} required /><br /><br />

                <input name="url.password" placeholder="password" type="password"
                       value={form.url.password} onChange={handleChange} required /><br /><br />

                <input name="url.host" placeholder="host"
                       value={form.url.host} onChange={handleChange} required /><br /><br />

                <input name="url.port" placeholder="port" type="number"
                       value={form.url.port} onChange={handleChange} required /><br /><br />

                <input name="url.database" placeholder="database"
                       value={form.url.database} onChange={handleChange} required /><br /><br />
            </fieldset>

            {/* --- connection.* -------------------------------------------------- */}
            <fieldset style={{padding:10, marginBottom:10, border: '2px solid grey',borderRadius:10}}>
                <legend>Метаданные</legend>

                <input name="connection.name" placeholder="name"
                       value={form.connection.name} onChange={handleChange} required /><br /><br />

                <input name="connection.description" placeholder="description"
                       value={form.connection.description} onChange={handleChange} required /><br /><br />
            </fieldset>

            <button type="submit" disabled={loading}>
                {loading ? 'Создаю…' : 'Создать'}
            </button>
            &nbsp;
            <button type="button" onClick={onCancel}>Отмена</button>

            {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
        </div>
    );
};
