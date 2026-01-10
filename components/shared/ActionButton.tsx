/**
 * ActionButton - Standardized button component for async actions
 * 
 * Provides consistent UX: loading states, disabled tooltips, icon spacing
 * Used across all action buttons for premium feel.
 */

'use client'

import { Button, type ButtonProps } from './Button'
import { Loader2 } from 'lucide-react'
import { ReactNode, useState } from 'react'

export interface ActionButtonProps extends Omit<ButtonProps, 'onClick' | 'disabled'> {
  onClick: ((e?: React.MouseEvent<HTMLButtonElement>) => Promise<void> | void) | (() => Promise<void> | void)
  loading?: boolean
  disabled?: boolean
  disabledReason?: string // Tooltip shown when disabled
  icon?: ReactNode
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline'
  confirmMessage?: string // Optional: show confirm dialog for dangerous actions
  showSuccessToast?: boolean // Auto-show success toast (requires toast hook)
  showErrorToast?: boolean // Auto-show error toast (requires toast hook)
}

/**
 * Standardized action button with loading/disabled/tooltip support
 * 
 * @example
 * ```tsx
 * const { run: generatePack, loading } = useAction(async () => {
 *   const blob = await fetch('/api/audit/export/pack', ...)
 *   downloadBlob(blob, 'proof-pack.zip')
 * })
 * 
 * <ActionButton
 *   onClick={() => generatePack()}
 *   loading={loading}
 *   disabled={!hasEvents}
 *   disabledReason={!hasEvents ? 'No events in selected window' : undefined}
 *   variant="primary"
 *   icon={<Package className="w-4 h-4" />}
 * >
 *   Generate Proof Pack
 * </ActionButton>
 * ```
 */
export function ActionButton({
  onClick,
  loading = false,
  disabled = false,
  disabledReason,
  icon,
  children,
  variant = 'primary',
  confirmMessage,
  className,
  ...props
}: ActionButtonProps) {
  const handleClick = async () => {
    if (loading || disabled) return

    // Optional confirm step for dangerous actions
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return
    }

    try {
      await onClick()
    } catch (err) {
      // Error handling is done by useAction hook or caller
      console.error('ActionButton error:', err)
    }
  }

  const isDisabled = disabled || loading

  // Use native title attribute for tooltip (works everywhere, no dependency)
  // For more advanced tooltips, can integrate shadcn/ui tooltip later
  const title = isDisabled && disabledReason ? disabledReason : undefined

  return (
    <Button
      variant={variant}
      className={className}
      disabled={isDisabled}
      onClick={handleClick}
      title={title}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {!loading && icon && <span className="mr-2">{icon}</span>}
      {children}
    </Button>
  )
}

