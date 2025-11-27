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
}

type TreeNode = {
    key: string;
    label: string;
    children?: TreeNode[];
    form?: WidgetForm; // есть только у листьев
};

/**
 * Строим дерево:
 * - если f.path есть → используем его как цепочку папок (разбиваем по "/");
 * - если path нет → корневая папка = workspace.name;
 * - лист (последний уровень) = form.name.
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
        const hasPath = f.path && f.path.trim().length > 0;

        const segments = hasPath
            ? f.path!
                .split('/')
                .map((p) => p.trim())
                .filter(Boolean)
            : [f.workspace?.name ?? 'Без workspace'];

        let currentList = roots;
        let currentKey = '';

        // создаём цепочку папок
        for (const seg of segments) {
            const key = currentKey ? `${currentKey}/${seg}` : seg;
            const node = findOrCreateNode(currentList, key, seg);
            currentList = node.children!;
            currentKey = key;
        }

        // добавляем лист-форму под последнюю папку
        const leafKey = `${currentKey}//form-${f.form_id}`;
        let leaf = currentList.find((n) => n.key === leafKey);
        if (!leaf) {
            leaf = {
                key: leafKey,
                label: f.name, // для совместимости, реальный текст возьмём из form.name
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

                // подписи
                const leafTitle =
                    isLeaf && node.form
                        ? (node.form.path && node.form.path.trim().length
                            ? `${node.form.path} / ${node.form.name}`
                            : node.form.name)
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
                                <span
                                    className={s.formName}
                                    title={leafTitle}
                                >
                    {node.form.name}
                </span>
                            ) : (
                                // ПАПКА: показываем часть path или workspace.name
                                <span
                                    className={s.treeLabel}
                                    title={node.label}
                                >
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

export const SideNav: React.FC<Props> = ({ open, toggle, forms, openForm }) => {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    /** Строим дерево из списка форм */
    const tree = useMemo(() => buildTreeFromForms(forms), [forms]);

    /** Сбрасываем раскрытие при закрытии меню */
    useEffect(() => {
        if (!open) {
            setExpanded(new Set());
        }
    }, [open]);

    /** Закрытие при клике вне блока + по Escape */
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

    return (
        <div className={s.wrap} ref={wrapRef}>
            <div
                className={s.burger}
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <MenuIcon />
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
