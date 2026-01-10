/**
 * useAction hook - Standardized async action handling
 * 
 * Provides loading state, error handling, and success/error callbacks
 * for consistent button UX across the application.
 */

import { useState, useCallback } from 'react'

export interface UseActionOptions<TResult> {
  onSuccess?: (result: TResult) => void
  onError?: (error: unknown) => void
  showSuccessToast?: boolean
  showErrorToast?: boolean
}

export interface UseActionReturn<TArgs extends any[], TResult> {
  run: (...args: TArgs) => Promise<TResult | undefined>
  loading: boolean
  error: Error | null
}

/**
 * Universal hook for async actions
 * 
 * @example
 * ```tsx
 * const { run: generatePack, loading } = useAction(
 *   async (view: string) => {
 *     const response = await fetch('/api/audit/export/pack', { ... })
 *     return response.blob()
 *   },
 *   {
 *     onSuccess: (blob) => {
 *       // Download file
 *       setToast({ message: 'Proof Pack generated', type: 'success' })
 *     },
 *     onError: (err) => {
 *       setToast({ message: err.message, type: 'error' })
 *     },
 *   }
 * )
 * 
 * <button onClick={() => generatePack('insurance-ready')} disabled={loading}>
 *   {loading ? 'Generating...' : 'Generate Proof Pack'}
 * </button>
 * ```
 */
export function useAction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: UseActionOptions<TResult> = {}
): UseActionReturn<TArgs, TResult> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const {
    onSuccess,
    onError,
  } = options

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setLoading(true)
    setError(null)

    try {
      const result = await fn(...args)
      onSuccess?.(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(err)
      throw error // Re-throw so caller can handle if needed
    } finally {
      setLoading(false)
    }
  }, [fn, onSuccess, onError])

  return { run, loading, error }
}

