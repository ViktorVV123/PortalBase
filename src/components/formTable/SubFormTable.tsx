import React from 'react';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import {SubDisplay} from "@/shared/hooks/useWorkSpaces";

type SubformProps = {
    subDisplay:SubDisplay | null;
    handleTabClick:(order: number) => void;
    subLoading:any
    subError:any
}

export const SubWormTable = ({subDisplay,handleTabClick,subLoading,subError}:SubformProps) => {
    return (
        <div>
            {subDisplay?.sub_widgets.length > 0 && (
                <ul className={s.tabs}>
                    {subDisplay.sub_widgets.map(sw => {
                        const isActive = sw.widget_order === subDisplay.displayed_widget.widget_order;
                        return (
                            <li key={sw.widget_order}>
                                <button
                                    className={isActive ? s.tabActive : s.tab}
                                    onClick={() => handleTabClick(sw.widget_order)}
                                >
                                    {sw.name}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {subDisplay && (
                subLoading ? (
                    <p>Загрузка sub-виджета…</p>
                ) : subError ? (
                    <p className={s.error}>{subError}</p>
                ) : (
                    <table className={s.tbl}>
                        <thead>
                        <tr>{subDisplay.columns.map(c => <th key={c.column_name}>{c.column_name}</th>)}</tr>
                        </thead>
                        <tbody>
                        {subDisplay.data.map((r, i) => (
                            <tr key={i}>{r.values.map((v, j) => <td key={j}>{v}</td>)}</tr>
                        ))}
                        </tbody>
                    </table>
                )
            )}
        </div>
    );
};

