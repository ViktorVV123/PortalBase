import React, { useMemo } from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import { WidgetColumn } from '@/shared/hooks/useWorkSpaces';

type ReferenceItem = WidgetColumn['reference'][number];

type WidgetColumnsMainTableProps = {
    widgetColumns: WidgetColumn[];
    referencesMap: Record<number, ReferenceItem[]>;
    handleDeleteReference: (wcId: number, tblColId: number) => void;

    // новый проп — шьём PATCH /widgets/columns/:id
    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;
};

export const WidgetColumnsMainTable: React.FC<WidgetColumnsMainTableProps> = ({
                                                                                  widgetColumns,
                                                                                  referencesMap,
                                                                                  handleDeleteReference,
                                                                                  updateWidgetColumn,
                                                                              }) => {
    // показываем в порядке column_order (как будет в форме)
    const orderedWc = useMemo(
        () =>
            [...widgetColumns].sort(
                (a, b) =>
                    (a.column_order ?? 0) - (b.column_order ?? 0) || a.id - b.id
            ),
        [widgetColumns]
    );

    const move = async (wcId: number, dir: 'up' | 'down') => {
        const list = orderedWc;
        const i = list.findIndex((w) => w.id === wcId);
        if (i < 0) return;

        const j = dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return; // край, двигать некуда

        const A = list[i];
        const B = list[j];

        const aOrder = A.column_order ?? 0;
        const bOrder = B.column_order ?? 0;

        // меняем местами column_order у пары
        await Promise.all([
            updateWidgetColumn(A.id, { column_order: bOrder }),
            updateWidgetColumn(B.id, { column_order: aOrder }),
        ]);
        // дальше обновление/перерисовка произойдёт за счёт пропсов (column_order изменился)
    };

    return (
        <div>
            <h3 style={{ margin: '24px 0 8px' }}>References</h3>

            {orderedWc.map((wc, idx) => {
                const refs: ReferenceItem[] =
                    referencesMap[wc.id] && referencesMap[wc.id].length
                        ? [...referencesMap[wc.id]]
                        : [...(wc.reference ?? [])];

                refs.sort(
                    (a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0)
                );

                const isFirst = idx === 0;
                const isLast = idx === orderedWc.length - 1;

                return (
                    <div key={wc.id} style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <h4 style={{ margin: 0 }}>{wc.alias ?? `Колонка #${wc.id}`}</h4>
                            <span style={{ color: 'grey' }}>({wc.column_order ?? 0})</span>

                            {/* Переместить ↑ ↓ */}
                            <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                                <button
                                    className={s.iconBtn}
                                    title="Переместить вверх"
                                    disabled={isFirst}
                                    onClick={() => move(wc.id, 'up')}
                                    style={{ opacity: isFirst ? 0.4 : 1 }}
                                >
                                    ↑
                                </button>
                                <button
                                    className={s.iconBtn}
                                    title="Переместить вниз"
                                    disabled={isLast}
                                    onClick={() => move(wc.id, 'down')}
                                    style={{ opacity: isLast ? 0.4 : 1 }}
                                >
                                    ↓
                                </button>
                            </div>
                        </div>

                        <table className={s.tbl} style={{ marginTop: 8 }}>
                            <thead>
                            <tr>
                                <th>name</th>
                                <th>ref_alias</th>
                                <th>type</th>
                                <th>width</th>
                                <th>default</th>
                                <th>placeholder</th>
                                <th>visible</th>
                                <th>ref_column_order</th>
                                <th></th>
                            </tr>
                            </thead>

                            <tbody>
                            {refs.length > 0 ? (
                                refs.map((r) => {
                                    const tblCol = r.table_column;
                                    const type =
                                        (r as any).type ?? tblCol?.datatype ?? '—';

                                    return (
                                        <tr
                                            key={`${wc.id}-${tblCol?.id ?? 'x'}-${
                                                r.ref_column_order ?? 0
                                            }`}
                                        >
                                            <td>{tblCol?.name ?? '—'}</td>
                                            <td>{(r as any).ref_alias ?? '—'}</td>
                                            <td>{type}</td>
                                            <td>{r.width ?? '—'}</td>
                                            <td>{wc.default ?? '—'}</td>
                                            <td>{wc.placeholder ?? '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {wc.visible ? '✔︎' : ''}
                                            </td>
                                            <td>{r.ref_column_order ?? 0}</td>
                                            <td>
                                                {tblCol?.id ? (
                                                    <DeleteIcon
                                                        className={s.actionIcon}
                                                        onClick={() =>
                                                            handleDeleteReference(wc.id, tblCol.id)
                                                        }
                                                    />
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', opacity: 0.7 }}>
                                        Нет связей
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
};

/*
{widgetColumns.map((wc) => {
    const refs = referencesMap[wc.id] ?? [];
    return (
        <div key={`ref-${wc.id}`} style={{ marginBottom: 24 }}>
            <h4 style={{ marginBottom: 6 }}>
                WidgetColumn&nbsp;{wc.id}
            </h4>

            {refs.length ? (
                <table className={s.tbl}>
                    <thead>
                    <tr>
                        <th>Name</th>
                        <th>Datatype</th>
                        <th>Width</th>
                        <th>combobox_visible</th>
                        <th>combobox_primary</th>
                        <th>ref_column_order</th>
                        <th />
                    </tr>
                    </thead>
                    <tbody>
                    {refs.map((r) => {
                        const isEd =
                            editing?.wcId === wc.id &&
                            editing.colId === r.table_column.id;

                        return (
                            <tr key={r.table_column.id}>
                                <td>{r.table_column.name}</td>
                                <td>{r.table_column.datatype}</td>


                                {/!* width *!/}
                                <td>
                                    {isEd ? (
                                        <input
                                            type="number"
                                            className={s.inp}
                                            value={form.width}
                                            onChange={bind(
                                                'width',
                                            )}
                                            style={{
                                                width: 70,
                                            }}
                                        />
                                    ) : (
                                        r.width
                                    )}
                                </td>

                                {/!* combobox_visible *!/}
                                <td style={{ textAlign: 'center' }}>
                                    {isEd ? (
                                        <input
                                            type="checkbox"
                                            checked={
                                                form.combobox_visible
                                            }
                                            onChange={bind(
                                                'combobox_visible',
                                            )}
                                        />
                                    ) : r.combobox_visible ? (
                                        '✔'
                                    ) : (
                                        ''
                                    )}
                                </td>

                                {/!* combobox_primary *!/}
                                <td style={{ textAlign: 'center' }}>
                                    {isEd ? (
                                        <input
                                            type="checkbox"
                                            checked={
                                                form.combobox_primary
                                            }
                                            onChange={bind(
                                                'combobox_primary',
                                            )}
                                        />
                                    ) : r.combobox_primary ? (
                                        '✔'
                                    ) : (
                                        ''
                                    )}
                                </td>

                                {/!* ref_column_order *!/}
                                <td style={{ textAlign: 'center' }}>
                                    {isEd ? (
                                        <input
                                            type="number"
                                            className={s.inp}
                                            style={{ width: 50 }}
                                            value={
                                                form.ref_column_order
                                            }
                                            onChange={bind(
                                                'ref_column_order',
                                            )}
                                        />
                                    ) : (
                                        r.ref_column_order
                                    )}
                                </td>

                                {/!* actions *!/}
                                <td style={{ textAlign: 'center' }}>
                                    {isEd ? (
                                        <>
                                            <button
                                                className={s.okBtn}
                                                onClick={save}
                                            >
                                                ✓
                                            </button>
                                            <button
                                                className={s.cancelBtn}
                                                onClick={cancel}
                                            >
                                                ✕
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <Editicon
                                                className={s.actionIcon}
                                                onClick={() =>
                                                    startEdit(
                                                        wc.id,
                                                        r,
                                                    )
                                                }
                                            />
                                            <DeleteIcon
                                                className={s.actionIcon}
                                                onClick={() =>
                                                    handleDeleteReference(
                                                        wc.id,
                                                        r.table_column.id,
                                                    )
                                                }
                                            />
                                        </>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            ) : (
                <p
                    style={{
                        fontStyle: 'italic',
                        color: '#777',
                    }}
                >
                    reference не найдены
                </p>
            )}
        </div>
    );
})}*/
