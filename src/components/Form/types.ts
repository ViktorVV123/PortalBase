import {FormDisplay} from "@/shared/hooks/useWorkSpaces";

export type HeaderModelItem = {
    id: number;         // widget_column_id
    title: string;      // заголовок группы (alias/fallback)
    labels: string[];   // подписи для каждой reference
    visible?: boolean;  // WC.visible
    refIds?: number[];  // порядок table_column_id
};

export type HeaderPlanGroup = {
    id: number;
    title: string;
    labels: string[];
    cols: FormDisplay['columns'];
};