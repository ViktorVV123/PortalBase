import React, { ReactNode, memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as s from '../TopComponent.module.scss';

export type Side = 'right' | 'left';

type Props = {
    anchor: HTMLElement | null;
    side: Side;
    children: ReactNode;
    setNode?: (el: HTMLDivElement | null) => void;
};

export const Floating = memo(function Floating({ anchor, side, children, setNode }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const frame = useRef<number | null>(null);

    const updatePos = useCallback(() => {
        if (!anchor || !ref.current) return;
        const ar = anchor.getBoundingClientRect();
        const menuEl = ref.current;
        const menuW = menuEl.offsetWidth || 360;
        const menuH = menuEl.offsetHeight || 300;

        const padding = 8;
        const maxLeft = window.innerWidth - menuW - padding;
        const maxTop = window.innerHeight - menuH - padding;

        const top = Math.max(padding, Math.min(maxTop, ar.top));
        const left =
            side === 'right'
                ? Math.min(maxLeft, ar.right + padding)
                : Math.max(padding, ar.left - menuW - padding);

        setPos({ top, left });
    }, [anchor, side]);

    const schedule = useCallback(() => {
        if (frame.current != null) return;
        frame.current = requestAnimationFrame(() => {
            frame.current = null;
            updatePos();
        });
    }, [updatePos]);

    useLayoutEffect(() => {
        setNode?.(ref.current);
        updatePos();
        window.addEventListener('scroll', schedule, true);
        window.addEventListener('resize', schedule);
        return () => {
            setNode?.(null);
            if (frame.current) cancelAnimationFrame(frame.current);
            window.removeEventListener('scroll', schedule, true);
            window.removeEventListener('resize', schedule);
        };
    }, [schedule, updatePos, setNode]);

    return createPortal(
        <div ref={ref} className={s.floatingMenu} style={{ top: pos.top, left: pos.left }}>
            <div className={s.floatingScroll}>{children}</div>
        </div>,
        document.body
    );
});
