'use client'

import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { updateUserCompany } from '@/lib/actions/admin'

interface CompanyCellProps {
  userId: string
  initialValue: string | null
}

export function CompanyCell({ userId, initialValue }: CompanyCellProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function handleSave() {
    setSaving(true)
    try {
      await updateUserCompany(userId, value)
      toast.success('Empresa actualizada ✓')
      setEditing(false)
    } catch {
      toast.error('Error al guardar la empresa')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setValue(initialValue ?? ''); setEditing(false) }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          placeholder="Empresa..."
          className="w-32 rounded px-2 py-0.5 text-xs text-white border border-[#00D9FF] bg-[rgba(0,217,255,0.05)] outline-none placeholder:text-white/30 disabled:opacity-50"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          title="Guardar"
          className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
        >
          {saving
            ? <span className="block h-3 w-3 animate-spin rounded-full border border-emerald-400/30 border-t-emerald-400" />
            : <Check className="h-3.5 w-3.5" />
          }
        </button>
        <button
          onClick={() => { setValue(initialValue ?? ''); setEditing(false) }}
          disabled={saving}
          title="Cancelar"
          className="text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <span>{value || '—'}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  )
}
