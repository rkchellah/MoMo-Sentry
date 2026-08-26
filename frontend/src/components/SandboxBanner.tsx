import { IconRadio } from './icons'

export function SandboxBanner() {
  return (
    <div className="status-strip">
      <span>
        <IconRadio />
        <strong>Sandbox</strong> · Nokia simulator numbers only
      </span>
      <span>Not a live Zambian SIM query</span>
    </div>
  )
}
