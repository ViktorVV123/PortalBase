import { useEffect, useState } from 'react';

export type FloatingPos = { top: number; left: number };

export function useFloating(
    anchor: HTMLElement | null,
    side: 'right' | 'left',
    gap = 8,
    widthApprox = 360,
    heightApprox = 520
) {
    const [pos, setPos] = useState<FloatingPos | null>(null);

    useEffect(() => {
        if (!anchor) { setPos(null); return; }

        const update = () => {
            const r = anchor.getBoundingClientRect();
            const topRaw = r.top - 6; // как у тебя в стилях
            const top = Math.max(8, Math.min(topRaw, window.innerHeight - 8 - heightApprox));

            let left = r.right + gap;
            if (side === 'left') left = r.left - gap - widthApprox;

            // удерживаем в пределах экрана
            left = Math.max(8, Math.min(left, window.innerWidth - 8 - widthApprox));

            setPos({ top, left });
        };

        update();
        // слушаем любые скроллы (в т.ч. внутри контейнеров)
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);

        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [anchor, side, gap, widthApprox, heightApprox]);

    return pos;
}
