import type { CSSProperties } from 'react'
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  id?: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
  'aria-label'?: string
  size?: 'sm' | 'default'
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  id,
  className,
  style,
  disabled,
  'aria-label': ariaLabel,
  size = 'default',
}: SelectProps) {
  return (
    <ShadcnSelect
      value={value || undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        size={size}
        className={cn('w-full min-w-0', className)}
        style={style}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectGroup>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </ShadcnSelect>
  )
}
