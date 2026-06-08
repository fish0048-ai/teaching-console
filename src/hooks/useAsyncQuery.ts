"use client";

import { useCallback, useEffect, useState } from "react";
import { formatFirebaseError } from "@/lib/firebase-errors";

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useAsyncQuery<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader();
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = formatFirebaseError(err);
      setState({ data: null, loading: false, error: message });
    }
  }, [loader]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload };
}
