'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/lib/context';

interface ApiKeyValidationResult {
  isValid: boolean;
  message: string;
}

export const useApiKey = () => {
  const { state, dispatch } = useApp();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ApiKeyValidationResult | null>(null);

  const validateApiKey = useCallback(async (apiKey?: string): Promise<ApiKeyValidationResult> => {
    const keyToValidate = apiKey || state.settings.apiKey;
    
    if (!keyToValidate.trim()) {
      const result = {
        isValid: false,
        message: 'API key is required',
      };
      setValidationResult(result);
      return result;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: keyToValidate.trim() }),
      });

      const data = await response.json();
      
      const result: ApiKeyValidationResult = {
        isValid: data.valid,
        message: data.valid ? 'API key is valid' : data.error || 'Invalid API key',
      };

      setValidationResult(result);
      return result;

    } catch (error) {
      const result: ApiKeyValidationResult = {
        isValid: false,
        message: 'Failed to validate API key. Please check your connection.',
      };
      
      setValidationResult(result);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, [state.settings.apiKey]);

  const setApiKey = useCallback((apiKey: string) => {
    dispatch({ type: 'SET_API_KEY', payload: apiKey });
    setValidationResult(null);
  }, [dispatch]);

  const clearApiKey = useCallback(() => {
    dispatch({ type: 'SET_API_KEY', payload: '' });
    setValidationResult(null);
  }, [dispatch]);

  const hasValidApiKey = useCallback((): boolean => {
    return state.settings.apiKey.trim().length > 0;
  }, [state.settings.apiKey]);

  return {
    apiKey: state.settings.apiKey,
    isValidating,
    validationResult,
    validateApiKey,
    setApiKey,
    clearApiKey,
    hasValidApiKey,
  };
};
