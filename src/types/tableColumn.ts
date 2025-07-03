export interface Column {
    id: number;
    table_id: number;
    name: string;
    description:string | null
    datatype: string;
    required: boolean;
    length: number | null | string;
    precision: number | null | string;
    primary: boolean;
    increment:boolean;
    datetime: number | null | string;
    // остальные поля по желанию
}