import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";

/**
 * Hook for fetching API data with loading/error states
 * 
 * Usage:
 *   const { data, loading, error, refetch } = useApi("/payments/history?page=1");
 */
export function useApi(path, options = {}) {
  const { immediate = true } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (overridePath) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(overridePath || path);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (immediate && path) {
      fetch();
    }
  }, [path, immediate]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for API mutations (POST, PUT, DELETE)
 * 
 * Usage:
 *   const { mutate, loading, error } = useMutation();
 *   const result = await mutate("/payments/create-order", { baseAmount: 5000, ... });
 */
export function useMutation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (path, body, method = "post") => {
    setLoading(true);
    setError(null);
    try {
      const result = await api[method](path, body);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error, clearError: () => setError(null) };
}
