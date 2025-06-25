export interface CreateConnectionDto {
    url: {
        drivername: string;
        username: string;
        password: string;
        host: string;
        port: number;
        database: string;
        query?: Record<string, unknown>;
    };
    connection: {
        name: string;
        description: string;
    };
}