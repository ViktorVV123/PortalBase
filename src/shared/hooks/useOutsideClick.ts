import { RefObject, useEffect } from 'react';

/**
 * Вызывает handler, если кликнули вне элемента ref.
 */
export const useOutsideClick = <T extends HTMLElement>(
    ref: RefObject<T>,
    handler: () => void,
) => {
    useEffect(() => {
        const listener = (e: MouseEvent) => {
            if (!ref.current || ref.current.contains(e.target as Node)) return;
            handler();
        };

        document.addEventListener('mousedown', listener);
        return () => document.removeEventListener('mousedown', listener);
    }, [ref, handler]);
};
