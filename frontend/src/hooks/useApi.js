import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Run an async loader on mount / when deps change, with loading + error state
 * and cancellation of stale requests (AbortController).
 *   const { data, error, loading, reload } = useApi((signal) => api.sectors({ signal }), []);
 */
export function useApi(loader, deps, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    loaderRef.current(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (!controller.signal.aborted && error.name !== 'AbortError') setState({ data: null, error, loading: false }); });
    return () => controller.abort();
  }, [...deps, enabled, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload, setData };
}
