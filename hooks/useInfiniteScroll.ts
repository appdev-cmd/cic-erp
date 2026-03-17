import { useState, useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions<T> {
    /** Function to fetch a page of data. Returns items and whether more pages exist. */
    fetchFn: (page: number) => Promise<{ data: T[]; hasMore: boolean; totalCount?: number }>;
    /** Number of items per page (batch size) */
    pageSize?: number;
    /** Dependencies that trigger a reset (e.g. search, filters) */
    resetDeps?: any[];
    /** Initial loading state */
    initialLoading?: boolean;
}

interface UseInfiniteScrollReturn<T> {
    /** Accumulated items from all loaded pages */
    items: T[];
    /** Whether the initial load is in progress */
    isLoading: boolean;
    /** Whether loading more items (subsequent pages) */
    isLoadingMore: boolean;
    /** Whether there are more items to load */
    hasMore: boolean;
    /** Total count from the server (if available) */
    totalCount: number;
    /** Ref to attach to the sentinel element at the bottom of the list */
    sentinelRef: React.RefObject<HTMLDivElement | null>;
    /** Manually reset the list (called automatically when resetDeps change) */
    reset: () => void;
    /** Update items in-place (e.g. after local edit/delete) */
    setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

export function useInfiniteScroll<T>({
    fetchFn,
    pageSize = 20,
    resetDeps = [],
    initialLoading = true,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
    const [items, setItems] = useState<T[]>([]);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(initialLoading);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const isFetchingRef = useRef(false);

    // Fetch data for a specific page
    const fetchPage = useCallback(async (pageNum: number, isReset: boolean) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isReset) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const result = await fetchFn(pageNum);

            if (isReset) {
                setItems(result.data);
            } else {
                // Deduplicate: prevent same item appearing in multiple pages
                setItems(prev => {
                    const existingIds = new Set(prev.map((item: any) => item.id));
                    const newItems = result.data.filter((item: any) => !existingIds.has(item.id));
                    return [...prev, ...newItems];
                });
            }

            setHasMore(result.hasMore);
            if (result.totalCount !== undefined) {
                setTotalCount(result.totalCount);
            }
        } catch (error) {
            console.error('useInfiniteScroll fetch error:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
            isFetchingRef.current = false;
        }
    }, [fetchFn]);

    // Reset when dependencies change
    useEffect(() => {
        setPage(1);
        setHasMore(true);
        setItems([]);
        fetchPage(1, true);
    }, resetDeps); // eslint-disable-line react-hooks/exhaustive-deps

    // Load more when page increments (beyond page 1)
    useEffect(() => {
        if (page > 1) {
            fetchPage(page, false);
        }
    }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    // IntersectionObserver for sentinel element
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && hasMore && !isFetchingRef.current) {
                    setPage(prev => prev + 1);
                }
            },
            {
                rootMargin: '400px', // Start loading earlier before user reaches the bottom
                threshold: 0.1
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isLoading]);

    const reset = useCallback(() => {
        setPage(1);
        setHasMore(true);
        setItems([]);
        fetchPage(1, true);
    }, [fetchPage]);

    return {
        items,
        isLoading,
        isLoadingMore,
        hasMore,
        totalCount,
        sentinelRef,
        reset,
        setItems,
    };
}

export default useInfiniteScroll;
