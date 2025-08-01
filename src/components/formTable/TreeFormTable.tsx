import React from 'react';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import FilterOffIcon from "@/assets/image/FilterOffIcon.svg";
import {FormTreeColumn, WidgetForm} from "@/shared/hooks/useWorkSpaces";

type TreeFormTableProps = {
    tree: FormTreeColumn[] | null;
    widgetForm: WidgetForm | null;
    handleResetFilters: () => void;
    activeExpandedKey: string | null;
    handleTreeValueClick: (table_column_id: number, value: string | number) => void;
    nestedTrees: Record<string, FormTreeColumn[]>;
    handleNestedValueClick: (table_column_id: number, value: string | number) => void;

}

export const TreeFormTable = ({
                                  tree,
                                  widgetForm,
                                  handleResetFilters,
                                  activeExpandedKey,
                                  handleTreeValueClick,
                                  nestedTrees,handleNestedValueClick,
                              }: TreeFormTableProps) => {
    return (
        <div>
            {tree && tree.length > 0 && (
                <div>
                    {tree.map(({name, values}, idx) => {
                        const currentTreeField = widgetForm?.tree_fields?.[idx];
                        const columnId = currentTreeField?.table_column_id;

                        return (
                            <div key={`${name}-${idx}`} className={s.treeList}>
                                <div className={s.treeHeader}>
                                    <span>{name}</span>
                                    <FilterOffIcon
                                        width={16}
                                        height={16}
                                        cursor="pointer"
                                        onClick={handleResetFilters}
                                    />
                                </div>
                                <ul className={s.treeUl}>
                                    {values.map((v, i) => {
                                        const key = `${columnId}-${v}`;
                                        const isExpanded = key === activeExpandedKey;

                                        return (
                                            <li key={i}>
                                                <div
                                                    className={s.treeItem}
                                                    onClick={() =>
                                                        columnId != null && handleTreeValueClick(columnId, v)
                                                    }
                                                >
                                                    {v}
                                                </div>

                                                {isExpanded && (
                                                    <ul className={s.nestedUl}>
                                                        {nestedTrees[key]?.map(({name, values, table_column_id}, j) =>
                                                            values.map((val, k) => (
                                                                <li
                                                                    key={`nested-${i}-${j}-${k}`}
                                                                    className={s.nestedItem}
                                                                    onClick={() => handleNestedValueClick(table_column_id, val)}
                                                                >
                                                                    {val}
                                                                </li>
                                                            ))
                                                        )}
                                                    </ul>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>

                        );
                    })}


                </div>
            )}
        </div>
    );
};

