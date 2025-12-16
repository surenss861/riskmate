'use client'

import React from 'react'
import * as Select from '@radix-ui/react-select'
import { ChevronDownIcon, CheckIcon } from '@radix-ui/react-icons'

type Option = { 
  label: string
  value: string
  disabled?: boolean
}

interface JobRosterSelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  options: Option[]
  disabled?: boolean
}

export function JobRosterSelect({
  value,
  onValueChange,
  placeholder,
  options,
  disabled = false,
}: JobRosterSelectProps) {
  // Radix doesn't allow empty string values, so we use a special value
  // Map empty string to "__all__" internally, but expose empty string to parent
  const ALL_VALUE = '__all__'
  
  // Filter out empty string options and replace with ALL_VALUE
  const validOptions = options.map(opt => ({
    ...opt,
    value: opt.value === '' ? ALL_VALUE : opt.value,
  }))
  
  // Convert empty string to ALL_VALUE for Radix
  const selectValue = value === '' ? ALL_VALUE : value
  
  return (
    <Select.Root 
      value={selectValue} 
      onValueChange={(newValue) => {
        // Convert ALL_VALUE back to empty string for parent
        onValueChange(newValue === ALL_VALUE ? '' : newValue)
      }} 
      disabled={disabled}
    >
      <Select.Trigger
        className="
          inline-flex h-10 items-center justify-between gap-2
          rounded-lg border border-white/15 bg-white/5 px-4 py-2
          text-sm text-white
          hover:bg-white/7
          focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:ring-offset-2 focus:ring-offset-[#0A0A0A]
          disabled:cursor-not-allowed disabled:opacity-50
          transition-colors
          min-w-[160px]
        "
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-white/60">
          <ChevronDownIcon />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="
            z-50
            min-w-[var(--radix-select-trigger-width)]
            max-h-[var(--radix-select-content-available-height)]
            overflow-hidden
            rounded-lg border border-white/10
            bg-[#0b0b0c] text-white
            shadow-2xl
          "
          position="popper"
          sideOffset={4}
        >
          <Select.ScrollUpButton className="hidden" />
          <Select.Viewport className="p-1">
            {validOptions.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="
                  relative flex items-center rounded-md px-3 py-2 text-sm
                  text-white
                  select-none outline-none
                  data-[highlighted]:bg-white/10 data-[highlighted]:text-white
                  data-[state=checked]:bg-[#F97316]/15 data-[state=checked]:text-white
                  data-[disabled]:opacity-40 data-[disabled]:pointer-events-none
                  cursor-pointer
                  transition-colors
                "
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-2 flex items-center">
                  <CheckIcon className="h-4 w-4" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="hidden" />
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

