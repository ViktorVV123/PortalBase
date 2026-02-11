// src/components/favourites/FavouritesList.tsx

import React, { useMemo, useState, useCallback } from 'react';
import * as s from './FavouritesList.module.scss';

import { api } from '@/services/api';
import { WidgetForm } from '@/shared/hooks/useWorkSpaces';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

interface Props {
    /** Все формы из formsById */
    formsById: Record<number, WidgetForm>;
    /** Callback при клике на форму */
    onOpenForm: (widgetId: number, formId: number) => void;
    /** Callback при изменении избранного (для синхронизации) */
    onFavouriteToggle?: (formId: number, isFavourite: boolean) => void;
}

type WorkspaceGroup = {
    id: number;
    name: string;
    forms: WidgetForm[];
};

export const FavouritesList: React.FC<Props> = ({
                                                    formsById,
                                                    onOpenForm,
                                                    onFavouriteToggle,
                                                }) => {
    const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

    // Группируем избранные формы по workspace
    const { groups, totalCount } = useMemo(() => {
        const favourites = Object.values(formsById).filter(f => f.is_favourite);

        const groupsMap = new Map<number, WorkspaceGroup>();

        for (const form of favourites) {
            const wsId = form.workspace?.id ?? 0;
            const wsName = form.workspace?.name ?? 'Без workspace';

            if (!groupsMap.has(wsId)) {
                groupsMap.set(wsId, { id: wsId, name: wsName, forms: [] });
            }
            groupsMap.get(wsId)!.forms.push(form);
        }

        // Сортируем группы по названию workspace
        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name, 'ru')
        );

        // Сортируем формы внутри каждой группы
        for (const group of sortedGroups) {
            group.forms.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        }

        return { groups: sortedGroups, totalCount: favourites.length };
    }, [formsById]);

    // Удаление из избранного
    const handleRemoveFavourite = useCallback(async (form: WidgetForm, e: React.MouseEvent) => {
        e.stopPropagation();

        const formId = form.form_id;

        setTogglingIds(prev => new Set(prev).add(formId));
        onFavouriteToggle?.(formId, false);

        try {
            await api.delete(`/favourites/${formId}`);
        } catch (error) {
            console.error('[FavouritesList] Failed to remove favourite:', error);
            onFavouriteToggle?.(formId, true);
        } finally {
            setTogglingIds(prev => {
                const next = new Set(prev);
                next.delete(formId);
                return next;
            });
        }
    }, [onFavouriteToggle]);

    // Клик по форме
    const handleFormClick = useCallback((form: WidgetForm) => {
        onOpenForm(form.main_widget_id, form.form_id);
    }, [onOpenForm]);

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    return (
        <div className={s.container}>
            <div className={s.header}>
                <StarIcon className={s.headerIcon} />
                <h2 className={s.title}>Избранные формы</h2>
                <span className={s.count}>{totalCount}</span>
            </div>

            {totalCount === 0 ? (
                <div className={s.empty}>
                    <StarBorderIcon className={s.emptyIcon} />
                    <p className={s.emptyText}>Нет избранных форм</p>
                    <p className={s.emptyHint}>
                        Нажмите на звёздочку ☆ рядом с формой в меню "Формы", чтобы добавить её в избранное
                    </p>
                </div>
            ) : (
                <div className={s.groups}>
                    {groups.map((group) => (
                        <div key={group.id} className={s.group}>
                            <div className={s.groupHeader}>
                                <FolderOpenIcon className={s.groupIcon} />
                                <span className={s.groupName}>{group.name}</span>
                                <span className={s.groupCount}>{group.forms.length}</span>
                            </div>

                            <div className={s.list}>
                                {group.forms.map((form) => {
                                    const isToggling = togglingIds.has(form.form_id);

                                    return (
                                        <div
                                            key={form.form_id}
                                            className={`${s.card} ${isToggling ? s.toggling : ''}`}
                                            onClick={() => handleFormClick(form)}
                                        >
                                            <div className={s.cardContent}>
                                                <div className={s.formName} title={form.name}>
                                                    {form.name}
                                                </div>

                                                {form.path && (
                                                    <div className={s.path} title={form.path}>
                                                        {form.path}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                className={s.removeBtn}
                                                onClick={(e) => handleRemoveFavourite(form, e)}
                                                title="Убрать из избранного"
                                                disabled={isToggling}
                                            >
                                                <StarIcon className={s.starIcon} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};