// A listbox that replaces <select>. The native control draws its option list
// through the OS, which ignores the page styling entirely — on Windows that
// means a blue highlight bar in an otherwise monochrome UI. This renders the
// list itself so it matches, and keeps the keyboard contract of a real select.

import React from 'react'
import { IconCheck, IconChevronDown } from './icons'

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
  style?: React.CSSProperties
  disabled?: boolean
  'aria-label'?: string
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
}: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const wrap = React.useRef<HTMLDivElement>(null)
  const list = React.useRef<HTMLUListElement>(null)

  const selected = options.findIndex(o => o.value === value)
  const label = selected >= 0 ? options[selected].label : placeholder

  const close = React.useCallback((refocus = true) => {
    setOpen(false)
    if (refocus) wrap.current?.querySelector('button')?.focus()
  }, [])

  const pick = React.useCallback((index: number) => {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    close()
  }, [options, onChange, close])

  // Clicking or tabbing away closes the list, same as a native select.
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onFocus = (e: FocusEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('focusin', onFocus)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    setActive(selected >= 0 ? selected : 0)
    // Focus moves to the list so arrow keys work without scrolling the page.
    const id = window.requestAnimationFrame(() => list.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open, selected])

  React.useEffect(() => {
    if (!open) return
    const el = list.current?.children[active] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function onButtonKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        setOpen(false)
        break
      case 'ArrowDown':
        e.preventDefault()
        setActive(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive(i => Math.max(i - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        pick(active)
        break
      default:
        break
    }
  }

  return (
    <div className={`select${className ? ` ${className}` : ''}`} style={style} ref={wrap}>
      <button
        type="button"
        id={id}
        className={`select-btn${open ? ' is-open' : ''}${selected < 0 ? ' is-empty' : ''}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onButtonKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="select-value">{label}</span>
        <IconChevronDown className="select-caret" />
      </button>

      {open && (
        <ul
          className="select-list"
          role="listbox"
          tabIndex={-1}
          ref={list}
          aria-activedescendant={options[active] ? `${id ?? 'sel'}-opt-${active}` : undefined}
          onKeyDown={onListKey}
        >
          {options.length === 0 && <li className="select-empty">No options</li>}
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id ?? 'sel'}-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`select-opt${i === active ? ' is-active' : ''}${o.value === value ? ' is-selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              <span className="select-opt-label">{o.label}</span>
              {o.value === value && <IconCheck />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
