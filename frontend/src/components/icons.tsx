import {
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  CircleAlert,
  CircleSlash,
  Eye,
  EyeOff,
  Inbox,
  List,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Map,
  MapPin,
  Moon,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Users,
  type LucideProps,
} from 'lucide-react'

type IconProps = LucideProps

const defaults = { strokeWidth: 2, 'aria-hidden': true as const }

export function IconEye(props: IconProps) {
  return <Eye size={16} {...defaults} {...props} />
}
export function IconEyeOff(props: IconProps) {
  return <EyeOff size={16} {...defaults} {...props} />
}
export function IconSun(props: IconProps) {
  return <Sun size={16} {...defaults} {...props} />
}
export function IconMoon(props: IconProps) {
  return <Moon size={16} {...defaults} {...props} />
}
export function IconArrow(props: IconProps) {
  return <ArrowRight size={16} {...defaults} {...props} />
}
export function IconAlert(props: IconProps) {
  return <CircleAlert size={16} {...defaults} style={{ flex: 'none' }} {...props} />
}
export function IconInbox(props: IconProps) {
  return <Inbox size={20} {...defaults} {...props} />
}
export function IconPin(props: IconProps) {
  return <MapPin size={16} {...defaults} {...props} />
}
export function IconSearch(props: IconProps) {
  return <Search size={16} {...defaults} {...props} />
}
export function IconRefresh(props: IconProps) {
  return <RefreshCw size={16} {...defaults} {...props} />
}
export function IconEnter(props: IconProps) {
  return <LogIn size={16} {...defaults} {...props} />
}
export function IconMail(props: IconProps) {
  return <Mail size={16} {...defaults} {...props} />
}
export function IconLock(props: IconProps) {
  return <Lock size={16} {...defaults} {...props} />
}
export function IconShield(props: IconProps) {
  return <ShieldCheck size={18} {...defaults} {...props} />
}
export function IconLogOut(props: IconProps) {
  return <LogOut size={16} {...defaults} {...props} />
}
export function IconLoader({ className, ...props }: IconProps) {
  return (
    <Loader2
      size={16}
      {...defaults}
      className={className ? `icon-spin ${className}` : 'icon-spin'}
      {...props}
    />
  )
}
export function IconCheck(props: IconProps) {
  return <Check size={16} {...defaults} {...props} />
}
export function IconChevronDown(props: IconProps) {
  return <ChevronDown size={16} {...defaults} {...props} />
}
export function IconBan(props: IconProps) {
  return <Ban size={16} {...defaults} {...props} />
}
export function IconCaution(props: IconProps) {
  return <TriangleAlert size={16} {...defaults} {...props} />
}
export function IconFailed(props: IconProps) {
  return <CircleSlash size={16} {...defaults} {...props} />
}
export function IconList(props: IconProps) {
  return <List size={16} {...defaults} {...props} />
}
export function IconMap(props: IconProps) {
  return <Map size={16} {...defaults} {...props} />
}
export function IconRadio(props: IconProps) {
  return <Radio size={14} {...defaults} {...props} />
}
export function IconUsers(props: IconProps) {
  return <Users size={16} {...defaults} {...props} />
}

export function BrandLockup({ invert = false }: { invert?: boolean }) {
  return (
    <div className="brand">
      <ShieldCheck size={18} strokeWidth={2} aria-hidden className="brand-mark" />
      <div className="brand-copy">
        <div className={`brand-kicker${invert ? ' is-invert' : ''}`}>Fraud checks</div>
        <div className="brand-name">MoMo Sentry</div>
      </div>
    </div>
  )
}
