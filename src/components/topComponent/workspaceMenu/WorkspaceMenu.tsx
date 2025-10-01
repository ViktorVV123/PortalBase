import React, { memo } from 'react';
import * as s from '../TopComponent.module.scss';
import WorkspacesIcon from '@/assets/image/WorkspacesIcon.svg';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import AddIcon from '@/assets/image/AddIcon.svg';
import { WorkSpaceTypes } from '@/types/typesWorkSpaces';

type Props = {
    workSpaces: WorkSpaceTypes[];
    wsOpenId: number | null;
    rootFocus: number;
    rootItemRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>;
    isDesktop: boolean;

    onRootKeyDown: (e: React.KeyboardEvent) => void;
    onOpenWs: (ws: WorkSpaceTypes, anchor: HTMLElement | null) => void;
    onEditWs: (ws: WorkSpaceTypes) => void;
    onDeleteWs: (ws: WorkSpaceTypes) => void;
    onCreateWorkspace: () => void;
    title?: string;
};

export const WorkspaceMenu = memo(function WorkspaceMenu({
                                                             workSpaces,
                                                             wsOpenId,
                                                             rootFocus,
                                                             rootItemRefs,
                                                             isDesktop,
                                                             onRootKeyDown,
                                                             onOpenWs,
                                                             onEditWs,
                                                             onDeleteWs,
                                                             onCreateWorkspace,
                                                             title = 'Рабочие пространства',
                                                         }: Props) {
    return (
        <div className={s.menuRoot} role="menu" aria-label={title} onKeyDown={onRootKeyDown}>
            <div className={s.scrollArea}>
                <div className={s.sectionTitle}>Действия</div>
                <ul className={s.list} role="none">
                    <li className={s.item} data-disabled="true" role="none">
                        <button className={s.itemBtn} role="menuitem" onClick={onCreateWorkspace}>
                            <AddIcon className={s.icon} />
                            <span className={s.label}>Создать рабочее пространство</span>
                        </button>
                    </li>
                </ul>

                <div className={s.sectionTitle}>Рабочее пространство</div>
                <ul className={s.list} role="none">
                    {workSpaces.map((ws, idx) => (
                        <li
                            key={ws.id}
                            className={s.item}
                            role="none"
                            onMouseEnter={
                                isDesktop ? (e) => onOpenWs(ws, e.currentTarget as unknown as HTMLElement) : undefined
                            }
                        >
                            <button
                                className={`${s.itemBtn} ${s.hasSub}`}
                                role="menuitem"
                                aria-haspopup="menu"
                                aria-expanded={wsOpenId === ws.id}
                                ref={(el) => {
                                    rootItemRefs.current[idx] = el;
                                }}
                                tabIndex={idx === rootFocus ? 0 : -1}
                                onClick={(e) => {
                                    if (!isDesktop) {
                                        if (wsOpenId === ws.id) {
                                            onOpenWs({ ...ws, id: null as unknown as number }, null);
                                        } else {
                                            onOpenWs(ws, e.currentTarget as unknown as HTMLElement);
                                        }
                                    }
                                }}
                                title={ws.description || ws.name}
                            >
                                <WorkspacesIcon className={s.icon} />
                                <span className={s.label}>{ws.name}</span>

                                <span className={s.actions} aria-hidden>
                  <EditIcon
                      className={s.actionIcon}
                      onClick={(e) => {
                          e.stopPropagation();
                          onEditWs(ws);
                      }}
                  />
                  <DeleteIcon
                      className={`${s.actionIcon} ${s.actionDanger}`}
                      onClick={(e) => {
                          e.stopPropagation();
                          onDeleteWs(ws);
                      }}
                  />
                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
});
