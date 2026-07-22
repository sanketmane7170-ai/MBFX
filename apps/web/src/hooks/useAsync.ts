import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

/** Runs an async fn on mount and whenever `deps` change; exposes reload(). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });

  const run = useCallback(() => {
    setState((s) => ({ data: s.data, loading: true }));
    fn()
      .then((data) => setState({ data, loading: false }))
      .catch((e: unknown) =>
        setState({
          loading: false,
          error: e instanceof Error ? e.message : 'Something went wrong',
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}
