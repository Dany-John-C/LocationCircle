import type { MemberRole } from '../store/groupStore'

interface RoleTagProps {
  role: MemberRole
  size?: 'sm' | 'md'
}

const roleConfig: Record<MemberRole, { label: string; classes: string }> = {
  head: {
    label: '★ Head',
    classes: 'bg-accent/20 text-accent border border-accent/40',
  },
  temp_head: {
    label: '◎ Temp Head',
    classes: 'bg-teal/20 text-teal-light border border-teal/40',
  },
  member: {
    label: 'Member',
    classes: 'bg-white/10 text-gray-400 border border-white/15',
  },
}

export default function RoleTag({ role, size = 'sm' }: RoleTagProps) {
  const { label, classes } = roleConfig[role]
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${sizeClass} ${classes}`}
      aria-label={`Role: ${label}`}
    >
      {label}
    </span>
  )
}
