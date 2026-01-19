// components/sideNav/SideNav.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as s from './SideNav.module.scss';

import MenuIcon from '@/assets/image/FormaIcon1.svg';
import FormaIcon from '@/assets/image/FormaIcon1.svg';
import { WidgetForm } from '@/shared/hooks/useWorkSpaces';

interface Props {
    open: boolean;
    toggle: () => void;
    forms: WidgetForm[];
    openForm: (widgetId: number, formId: number) => void;
    /** Текст рядом с иконкой (например "Формы") */
    label?: string;
}

type TreeNode = {
    key: string;
    label: string;
    children?: TreeNode[];
    form?: WidgetForm; // есть только у листьев
};

/**
 * Дерево:
 * 1) Всегда корень – workspace.name (отдельная папка).
 * 2) Если path есть → внутри workspace создаём подпапки по сегментам path.
 * 3) Если path пуст → внутри workspace сразу листья с form.name.
 */
const buildTreeFromForms = (forms: WidgetForm[]): TreeNode[] => {
    const roots: TreeNode[] = [];

    const findOrCreateNode = (list: TreeNode[], key: string, label: string): TreeNode => {
        let node = list.find((n) => n.key === key);
        if (!node) {
            node = { key, label, children: [] };
            list.push(node);
        }
        if (!node.children) node.children = [];
        return node;
    };

    for (const f of forms) {
        const workspaceLabel = f.workspace?.name ?? 'Без workspace';
        const workspaceIdOrName = f.workspace?.id ?? workspaceLabel;

        // 1) корневая папка — workspace
        const wsKey = `ws-${workspaceIdOrName}`;
        const wsNode = findOrCreateNode(roots, wsKey, workspaceLabel);

        let currentList = wsNode.children!;
        let currentKey = wsKey;

        // 2) path → сегменты (если есть)
        let pathSegments: string[] = [];

        if (f.path && f.path.trim().length > 0) {
            const segments = f.path
                .split('/')
                .map((p) => p.trim())
                .filter(Boolean);

            // если первый сегмент совпадает с названием workspace — пропускаем, чтобы не дублировать
            if (segments.length > 0 && segments[0] === workspaceLabel) {
                segments.shift();
            }

            pathSegments = segments;
        }

        // 3) создаём цепочку подпапок внутри workspace (если есть path)
        for (const seg of pathSegments) {
            const key = `${currentKey}/${seg}`;
            const node = findOrCreateNode(currentList, key, seg);
            currentList = node.children!;
            currentKey = key;
        }

        // 4) добавляем лист-форму под последнюю папку (или прямо под workspace, если path пустой)
        const leafKey = `${currentKey}//form-${f.form_id}`;
        let leaf = currentList.find((n) => n.key === leafKey);
        if (!leaf) {
            leaf = {
                key: leafKey,
                label: f.name, // реальный текст листа всё равно берём из form.name
                form: f,
            };
            currentList.push(leaf);
        } else {
            leaf.form = f;
            leaf.label = f.name;
        }
    }

    return roots;
};

type TreeProps = {
    nodes: TreeNode[];
    expanded: Set<string>;
    toggleNode: (key: string) => void;
    onLeafClick: (form: WidgetForm) => void;
};

const Tree: React.FC<TreeProps> = ({ nodes, expanded, toggleNode, onLeafClick }) => {
    if (!nodes.length) return null;

    return (
        <ul className={s.treeList}>
            {nodes.map((node) => {
                const isFolder = !!node.children && node.children.length > 0 && !node.form;
                const isLeaf = !!node.form;
                const isOpen = isFolder && expanded.has(node.key);

                const handleClick = () => {
                    if (isFolder) {
                        toggleNode(node.key);
                    } else if (isLeaf && node.form) {
                        onLeafClick(node.form);
                    }
                };

                // title для подсказки по hover
                const leafTitle =
                    isLeaf && node.form
                        ? `${node.form.workspace?.name ?? ''}${
                            node.form.path && node.form.path.trim().length
                                ? ` / ${node.form.path}`
                                : ''
                        } / ${node.form.name}`
                        : undefined;

                return (
                    <li key={node.key}>
                        <div
                            className={`${s.treeItem} ${isFolder ? s.folderItem : s.leafItem}`}
                            onClick={handleClick}
                        >
                            {isFolder ? (
                                <span className={s.folderArrow}>{isOpen ? '▾' : '▸'}</span>
                            ) : (
                                <FormaIcon className={s.icon} />
                            )}

                            {isLeaf && node.form ? (
                                // ЛИСТ: показываем только form.name (обрезка по CSS)
                                <span className={s.formName} title={leafTitle}>
                                    {node.form.name}
                                </span>
                            ) : (
                                // ПАПКА: workspace.name или сегмент path
                                <span className={s.treeLabel} title={node.label}>
                                    {node.label}
                                </span>
                            )}
                        </div>

                        {isFolder && isOpen && node.children && node.children.length > 0 && (
                            <Tree
                                nodes={node.children}
                                expanded={expanded}
                                toggleNode={toggleNode}
                                onLeafClick={onLeafClick}
                            />
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

export const SideNav: React.FC<Props> = ({ open, toggle, forms, openForm, label }) => {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const tree = useMemo(() => buildTreeFromForms(forms), [forms]);

    // сбрасываем раскрытие при закрытии меню
    useEffect(() => {
        if (!open) {
            setExpanded(new Set());
        }
    }, [open]);

    // закрытие по клику вне и по Escape
    useEffect(() => {
        if (!open) return;

        const handleClickAway = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node | null;
            if (!wrapRef.current || !target) return;
            if (!wrapRef.current.contains(target)) {
                toggle();
            }
        };

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                toggle();
            }
        };

        document.addEventListener('mousedown', handleClickAway);
        document.addEventListener('touchstart', handleClickAway, { passive: true });
        document.addEventListener('keydown', handleKey);

        return () => {
            document.removeEventListener('mousedown', handleClickAway);
            document.removeEventListener('touchstart', handleClickAway);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open, toggle]);

    const toggleNode = (key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleLeafClick = (f: WidgetForm) => {
        openForm(f.main_widget_id, f.form_id);
        toggle();
    };

    // Если есть label — показываем текст рядом с иконкой
    const hasLabel = !!label;

    return (
        <div className={s.wrap} ref={wrapRef}>
            <div
                className={s.burger}
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                title={label ?? 'Открыть список форм'}
            >
                <MenuIcon />
                {hasLabel && (
                    <>
                        <span className={s.triggerLabel}>{label}</span>
                        <span className={s.triggerArrow}>▾</span>
                    </>
                )}
            </div>

            {open && forms.length > 0 && (
                <div className={s.popup}>
                    <Tree
                        nodes={tree}
                        expanded={expanded}
                        toggleNode={toggleNode}
                        onLeafClick={handleLeafClick}
                    />
                </div>
            )}
        </div>
    );
};