'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ActivityType } from '@/lib/types/common'

interface FilterBarProps {
  currentType: ActivityType
  currentChannel: string | null
  channels: string[]
}

const CHANNEL_LABELS: Record<string, string> = {
  cold_call: 'Llamada fría',
  cold_message: 'Mensaje frío',
  linkedin_dm: 'DM LinkedIn',
  linkedin_post: 'Post LinkedIn',
  linkedin_comment: 'Comentario LinkedIn',
  networking_event: 'Evento Networking',
  networking_lead: 'Lead Networking',
  referral: 'Referido',
  mkt_lead: 'Lead MKT',
  vsl_lead: 'Lead VSL',
  other: 'Otro',
}

export function FilterBar({ currentType, currentChannel, channels }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'ALL' && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Type filter */}
      <Select
        value={currentType}
        onValueChange={(v) => v && updateParam('type', v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Todo">
            {currentType === 'OUTBOUND' ? 'Solo Outbound' : currentType === 'INBOUND' ? 'Solo Inbound' : 'Todo'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todo</SelectItem>
          <SelectItem value="OUTBOUND">Solo Outbound</SelectItem>
          <SelectItem value="INBOUND">Solo Inbound</SelectItem>
        </SelectContent>
      </Select>

      {/* Channel filter */}
      {channels.length > 0 && (
        <Select
          value={currentChannel ?? 'all'}
          onValueChange={(v) => v && updateParam('channel', v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos los canales">
              {currentChannel ? (CHANNEL_LABELS[currentChannel] ?? currentChannel) : 'Todos los canales'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los canales</SelectItem>
            {channels.map((ch) => (
              <SelectItem key={ch} value={ch}>
                {CHANNEL_LABELS[ch] ?? ch}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
