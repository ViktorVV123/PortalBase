export interface TableDraft {
    /** отображаемое имя таблицы */
    name: string;
    /** описание / комментарий */
    description: string;
    /** SQL для чтения */
    select_query: string;
    /** SQL для вставки */
    insert_query: string;
    /** SQL для обновления */
    update_query: string;
    /** SQL для удаления */
    delete_query: string;
    /** публиковать ли таблицу во внешнем интерфейсе */
    published: boolean;
}