// src/components/Form/mainTable/hook/useInfiniteScroll.ts

import { useCallback, useEffect, useRef } from 'react';

type UseInfiniteScrollOptions = {
    /** Загружать ещё когда до конца осталось threshold px */
    threshold?: number;
    /** Есть ли ещё данные для загрузки */
    hasMore: boolean;
    /** Идёт ли сейчас загрузка */
    isLoading: boolean;
    /** Функция загрузки следующей порции */
    onLoadMore: () => void;
};

/**
 * Хук для infinite scroll — вызывает onLoadMore когда скролл достигает конца
 */
export function useInfiniteScroll({
                                      threshold = 200,
                                      hasMore,
                                      isLoading,
                                      onLoadMore,
                                  }: UseInfiniteScrollOptions) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isLoadingRef = useRef(isLoading);

    // Обновляем ref при изменении isLoading
    useEffect(() => {
        isLoadingRef.current = isLoading;
    }, [isLoading]);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        // Не загружаем если уже загружаем или нечего загружать
        if (isLoadingRef.current || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = el;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;

        // Если до конца меньше threshold — загружаем
        if (distanceToBottom < threshold) {
            onLoadMore();
        }
    }, [hasMore, threshold, onLoadMore]);

    // Подписываемся на scroll
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            el.removeEventListener('scroll', handleScroll);
        };
    }, [handleScroll]);

    return { scrollRef };
}