export type ConnectionURL = {
    drivername: string;
    username: string;
    password?: string;                 // сервер пароль не возвращает (маска), делаем опц.
    host: string;
    port: number;
    database: string;
    query: Record<string, any>;
};

export type Connection = {
    id: number;
    name: string;
    description: string | null;
    conn_type: string;                 // "sqlalchemy" и т.п.
    conn_str?: string | null;          // может быть на GET списка
    url?: ConnectionURL;               // ← опционально, чтобы не падать, когда его нет
};