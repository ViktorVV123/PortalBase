import React, {useEffect, useRef, useState} from 'react';
import * as s from '../../components/setOfTables/SetOfTables.module.scss'

type EllipsizeSmartProps = {
    text?: string | null;
    className?: string;
    /** 1 — одна строка (nowrap+ellipsis), >1 — line-clamp */
    maxLines?: number;
};

export const EllipsizeSmart: React.FC<EllipsizeSmartProps> = ({ text, className, maxLines = 1 }) => {
    const content = text ?? '—';
    const ref = useRef<HTMLDivElement>(null);
    const [overflowed, setOverflowed] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const check = () => {
            const isOverflow = maxLines === 1
                ? el.scrollWidth > el.clientWidth
                : el.scrollHeight > el.clientHeight + 1;
            setOverflowed(isOverflow);
        };

        check();

        const ro = new ResizeObserver(check);
        ro.observe(el);
        window.addEventListener('resize', check);

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', check);
        };
    }, [text, maxLines]);

    return (
        <div
            ref={ref}
            className={[
                maxLines === 1 ? s.ellipsis : s.clamp,
                className ?? ''
            ].join(' ')}
            style={{ ['--lines' as any]: String(maxLines) }}
            title={overflowed ? content : undefined} // нативный tooltip ТОЛЬКО при overflow
        >
            {content}
        </div>
    );
};
