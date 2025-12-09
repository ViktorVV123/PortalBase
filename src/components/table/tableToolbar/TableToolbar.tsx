import React, {useMemo, useState} from 'react';
import * as cls from './TableToolbar.module.scss';
import {ButtonForm} from '@/shared/buttonForm/ButtonForm';
import {SearchBox} from '@/components/common/SearchBox';
import FilterOffIcon from '@/assets/image/FilterOffIcon.svg';
import AddIcon from "@mui/icons-material/Add";


type Props = {
    // для ButtonForm
    isAdding: boolean;
    selectedFormId: number | null;
    selectedWidget: any;
    saving: boolean;
    startAdd: () => void;
    submitAdd: () => void;
    cancelAdd: () => void;

    // поиск
    showSearch: boolean;
    value: string;
    onChange: (v: string) => void;

    // сброс фильтров
    onResetFilters: () => void;

    // опционально
    collapsedWidth?: number; // px
    expandedWidth?: number;  // px
    cancelAddSub: any
    startAddSub: any
    isAddingSub: any
    submitAddSub: any
    savingSub: any
    showSubActions: boolean;


};


export const TableToolbar = ({
                                 isAdding,
                                 selectedFormId,
                                 selectedWidget,
                                 saving,
                                 startAdd,
                                 submitAdd,
                                 cancelAdd,
                                 cancelAddSub,
                                 startAddSub,
                                 isAddingSub,
                                 submitAddSub,
                                 savingSub,
                                 showSearch,
                                 value,
                                 showSubActions = false,
                                 onChange,
                                 onResetFilters,
                                 collapsedWidth = 170,
                                 expandedWidth = 380,
                             }: Props) => {
    const [focused, setFocused] = useState(false);
    const expanded = focused || !!value;

    const searchStyleVars = useMemo(() => ({
        ['--collapsed' as any]: `${collapsedWidth}px`,
        ['--expanded' as any]: `${expandedWidth}px`,
    }), [collapsedWidth, expandedWidth]);

    return (
        <div className={cls.root}>
            <div className={cls.bar}>
                <div className={cls.leftGroup}>
                    <button className={cls.iconBtn} onClick={onResetFilters} title="Сбросить фильтры">
                        <FilterOffIcon/>
                    </button>

                    <div className={cls.divider}/>

                    <ButtonForm

                        isAdding={isAdding}
                        selectedFormId={selectedFormId}
                        selectedWidget={selectedWidget}
                        saving={saving}
                        startAdd={startAdd}
                        submitAdd={submitAdd}
                        cancelAdd={cancelAdd}
                        buttonClassName={cls.iconBtn}   // ← ключевое: одинаковый стиль
                    />
                    <div className={cls.divider}/>
                    {showSubActions && (
                        <>
                            <ButtonForm
                                showSubActions={showSubActions}
                                cancelAdd={cancelAddSub!}
                                startAdd={startAddSub!}
                                isAdding={!!isAddingSub}
                                submitAdd={submitAddSub!}
                                saving={!!savingSub}
                                selectedWidget={selectedWidget}
                                selectedFormId={selectedFormId}
                                buttonClassName={cls.iconBtn}
                            />
                            <div className={cls.divider}/>
                        </>
                    )}
                </div>

                {showSearch && (
                    <div
                        className={cls.searchWrap}
                        data-expanded={expanded ? '1' : '0'}
                        style={searchStyleVars as React.CSSProperties}
                    >
                        <SearchBox
                            value={value}
                            onChange={onChange}
                            placeholder="Поиск…"
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') onChange('');
                            }}
                            autoFocus={false}
                            // @ts-ignore
                            onFocus={() => setFocused(true)}
                            // @ts-ignore
                            onBlur={() => setFocused(false)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
