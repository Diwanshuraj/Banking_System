import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

interface ApiState<T> {
    data: T | undefined;
    error: ApiError | undefined;
    isLoading: boolean;
    /** Re-runs the request; keeps the previous data visible while loading. */
    reload: () => Promise<void>;
    setData: (data: T) => void;
}

/**
 * Runs `fetcher` on mount and whenever `deps` change.
 * Responses from stale requests are ignored so fast filter changes never show old data.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
    const [data, setData] = useState<T>();
    const [error, setError] = useState<ApiError>();
    const [isLoading, setIsLoading] = useState(true);
    const requestId = useRef(0);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const run = useCallback(fetcher, deps);

    const reload = useCallback(async () => {
        const id = ++requestId.current;
        setIsLoading(true);
        try {
            const result = await run();
            if (id === requestId.current) {
                setData(result);
                setError(undefined);
            }
        } catch (err) {
            if (id === requestId.current) setError(err instanceof ApiError ? err : new ApiError({ status: 0, message: String(err) }));
        } finally {
            if (id === requestId.current) setIsLoading(false);
        }
    }, [run]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { data, error, isLoading, reload, setData };
}

/** Message to show for any thrown value. */
export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.");
