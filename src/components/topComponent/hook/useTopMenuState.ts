import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DTable, Widget } from '@/shared/hooks/useWorkSpaces';
import type { WorkSpaceTypes } from '@/types/typesWorkSpaces';
import type { Side } from '../floating/Floating';

export type OpenState = { id: number | null; anchor: HTMLElement | null; side: Side };

const useIsDesktop = () =>
    useMemo(
        () =>
            typeof window !== 'undefined'
                ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
                : true,
        []
    );

export function computeSide(anchor: HTMLElement | null, approxWidth = 360): Side {
    if (!anchor) return 'right';
    const rect = anchor.getBoundingClientRect();
    const rightSpace = window.innerWidth - rect.right;
    const leftSpace = rect.left;
    return rightSpace < approxWidth && leftSpace > rightSpace ? 'left' : 'right';
}

export function useTopMenuState(deps: {
    loadTables: (id: number, force?: boolean) => Promise<any>;
    loadWidgetsForTable: (id: number, force?: boolean) => void;
    handleSelectTable: (t: DTable) => void;
    handleSelectWidget: (w: Widget) => void;
    handleSelectForm: (id: number) => void;
    loadFormTree: (id: number) => Promise<void>;
    setNavOpen: (v: boolean) => void;
    setWsHover: (v: number | null) => void;
    setTblHover: (v: number | null) => void;
}) {
    const {
        loadTables,
        loadWidgetsForTable,
        handleSelectTable,
        handleSelectWidget,
        handleSelectForm,
        loadFormTree,
        setNavOpen,
        setWsHover,
        setTblHover,
    } = deps;

    const [open, setOpen] = useState(false);
    const [wsOpen, setWsOpen] = useState<OpenState>({ id: null, anchor: null, side: 'right' });
    const [tblOpen, setTblOpen] = useState<OpenState>({ id: null, anchor: null, side: 'right' });
    const [wOpen, setWOpen] = useState<OpenState>({ id: null, anchor: null, side: 'right' });

    // ═══════════════════════════════════════════════════════════════════════════
    // НОВОЕ: Состояния загрузки для каждого уровня меню
    // ═══════════════════════════════════════════════════════════════════════════
    const [tablesLoading, setTablesLoading] = useState(false);
    const [widgetsLoading, setWidgetsLoading] = useState(false);

    const [wsNode, setWsNode] = useState<HTMLDivElement | null>(null);
    const [tblNode, setTblNode] = useState<HTMLDivElement | null>(null);
    const [wNode, setWNode] = useState<HTMLDivElement | null>(null);

    const menuRef = useRef<HTMLDivElement>(null);
    const isDesktop = useIsDesktop();

    const rootItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [rootFocus, setRootFocus] = useState(0);

    const resetLevels = useCallback(() => {
        setWsOpen({ id: null, anchor: null, side: 'right' });
        setTblOpen({ id: null, anchor: null, side: 'right' });
        setWOpen({ id: null, anchor: null, side: 'right' });
        // Сбрасываем loading при закрытии
        setTablesLoading(false);
        setWidgetsLoading(false);
    }, []);

    const closeAll = useCallback(() => {
        setOpen(false);
        resetLevels();
        setWsHover(null);
        setTblHover(null);
    }, [resetLevels, setTblHover, setWsHover]);

    const handleTriggerClick = useCallback(() => {
        if (open) {
            closeAll();
        } else {
            setNavOpen(false);
            setOpen(true);
            setRootFocus(0);
            resetLevels();
        }
    }, [open, closeAll, resetLevels, setNavOpen]);

    // клик-вне
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (!open) return;
            const t = e.target as Node;
            const insideRoot = !!menuRef.current && menuRef.current.contains(t);
            const insideWs = !!wsNode && wsNode.contains(t);
            const insideTbl = !!tblNode && tblNode.contains(t);
            const insideW = !!wNode && wNode.contains(t);
            if (!insideRoot && !insideWs && !insideTbl && !insideW) closeAll();
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open, wsNode, tblNode, wNode, closeAll]);

    // ESC
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                closeAll();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, closeAll]);

    // ═══════════════════════════════════════════════════════════════════════════
    // ОБНОВЛЕНО: openWs с индикатором загрузки
    // ═══════════════════════════════════════════════════════════════════════════
    const openWs = useCallback(
        async (ws: WorkSpaceTypes, anchor: HTMLElement | null) => {
            if (ws?.id) {
                setWsHover(ws.id);

                // Сразу открываем подменю и показываем лоадер
                setWsOpen({ id: ws.id, anchor, side: computeSide(anchor) });
                setTblOpen({ id: null, anchor: null, side: 'right' });
                setWOpen({ id: null, anchor: null, side: 'right' });

                // Включаем лоадер
                setTablesLoading(true);

                try {
                    await loadTables(ws.id);
                } finally {
                    setTablesLoading(false);
                }
            } else {
                setWsOpen({ id: null, anchor: null, side: 'right' });
                setTblOpen({ id: null, anchor: null, side: 'right' });
                setWOpen({ id: null, anchor: null, side: 'right' });
            }
        },
        [loadTables, setWsHover]
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // ОБНОВЛЕНО: openTbl с индикатором загрузки
    // ═══════════════════════════════════════════════════════════════════════════
    const openTbl = useCallback(
        async (t: DTable, anchor: HTMLElement | null, widgetsByTable: Record<number, Widget[]>) => {
            if (t?.id) {
                setTblHover(t.id);

                // Сразу открываем подменю
                setTblOpen({ id: t.id, anchor, side: computeSide(anchor) });
                setWOpen({ id: null, anchor: null, side: 'right' });

                // Если виджеты ещё не загружены — показываем лоадер
                if (!widgetsByTable[t.id]) {
                    setWidgetsLoading(true);
                    try {
                        await loadWidgetsForTable(t.id);
                    } finally {
                        setWidgetsLoading(false);
                    }
                }
            } else {
                setTblOpen({ id: null, anchor: null, side: 'right' });
                setWOpen({ id: null, anchor: null, side: 'right' });
            }
        },
        [loadWidgetsForTable, setTblHover]
    );

    const openWidget = useCallback((w: Widget, anchor: HTMLElement | null) => {
        if (w?.id) setWOpen({ id: w.id, anchor, side: computeSide(anchor) });
        else setWOpen({ id: null, anchor: null, side: 'right' });
    }, []);

    // клава root
    const focusRootIndex = useCallback(
        (idx: number) => {
            const list = rootItemRefs.current;
            const next = Math.max(0, Math.min(idx, list.length - 1));
            setRootFocus(next);
            const el = list[next];
            if (el) {
                el.focus({ preventScroll: true });
                el.scrollIntoView({ block: 'nearest' });
            }
        },
        [setRootFocus]
    );

    const onRootKeyDown = useCallback(
        (e: React.KeyboardEvent, workSpaces: WorkSpaceTypes[]) => {
            const key = e.key;
            if (key === 'ArrowDown') {
                e.preventDefault();
                focusRootIndex(rootFocus + 1);
            } else if (key === 'ArrowUp') {
                e.preventDefault();
                focusRootIndex(rootFocus - 1);
            } else if (key === 'Home') {
                e.preventDefault();
                focusRootIndex(0);
            } else if (key === 'End') {
                e.preventDefault();
                focusRootIndex(999);
            } else if (key === 'ArrowRight') {
                const ws = workSpaces[rootFocus];
                if (ws) {
                    const btn = rootItemRefs.current[rootFocus];
                    openWs(ws, btn || null);
                }
            } else if (key === 'Escape') {
                closeAll();
            }
        },
        [focusRootIndex, rootFocus, openWs, closeAll]
    );

    return {
        // state
        open,
        wsOpen,
        tblOpen,
        wOpen,
        isDesktop,
        rootFocus,
        menuRef,
        rootItemRefs,

        // ═══════════════════════════════════════════════════════════════════════
        // НОВОЕ: экспортируем состояния загрузки
        // ═══════════════════════════════════════════════════════════════════════
        tablesLoading,
        widgetsLoading,

        // nodes for click-outside
        wsNode,
        tblNode,
        wNode,
        setWsNode,
        setTblNode,
        setWNode,

        // actions
        setOpen,
        closeAll,
        handleTriggerClick,
        openWs,
        openTbl,
        openWidget,
        onRootKeyDown,
    };
}