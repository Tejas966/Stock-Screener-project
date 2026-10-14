import { createContext, useContext } from 'react';
import { useApi } from '../hooks/useApi.js';
import { api } from '../services/api.js';

const MetaContext = createContext({ meta: null, loading: true });

/** Public server configuration: active data provider (demo or live) and AI availability. */
export function MetaProvider({ children }) {
  const { data, loading, error } = useApi((signal) => api.meta({ signal }), []);
  return <MetaContext.Provider value={{ meta: data, loading, error }}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);
