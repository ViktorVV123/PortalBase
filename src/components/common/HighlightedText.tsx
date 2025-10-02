import React from 'react';

type Range = { indices: [number, number][]; key: string; value: string };
type Props = { text: string; ranges?: Range[] };

export const HighlightedText: React.FC<Props> = ({ text, ranges }) => {
    if (!ranges || ranges.length === 0) return <>{text}</>;

    // Склеиваем все интервалы из Fuse (на всякий случай сортируем и сливаем)
    const merged: [number, number][] = [];
    for (const r of ranges) {
        for (const [s, e] of r.indices) merged.push([s, e]);
    }
    merged.sort((a, b) => a[0] - b[0]);

    const compact: [number, number][] = [];
    for (const [s, e] of merged) {
        const last = compact[compact.length - 1];
        if (!last || s > last[1] + 1) compact.push([s, e]);
        else last[1] = Math.max(last[1], e);
    }

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    compact.forEach(([s, e], i) => {
        if (cursor < s) parts.push(<span key={`t${i}-n`}>{text.slice(cursor, s)}</span>);
        parts.push(<mark key={`t${i}-h`}>{text.slice(s, e + 1)}</mark>);
        cursor = e + 1;
    });
    if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);

    return <>{parts}</>;
};
