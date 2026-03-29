'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepWelcome } from './StepWelcome'
import { StepRecipe } from './StepRecipe'
import { StepActivities } from './StepActivities'
import { saveOnboardingRecipe, saveOnboardingActivities } from '@/lib/actions/onboarding'

export type WizardStep = 1 | 2 | 3

interface RecipeData {
  name: string
  monthly_revenue_goal: number
  average_ticket: number
  outbound_pct: number
  funnel_stages: string[]
  outbound_rates: number[]
  inbound_rates: number[]
}

export function OnboardingWizard({ userName }: { userName: string | null }) {
  const router = useRouter()
  const [step, setStep]           = useState<WizardStep>(1)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleRecipeSave(data: RecipeData) {
    setSaving(true)
    setSaveError(null)
    try {
      await saveOnboardingRecipe(data)
      setStep(3)
    } catch (e) {
      console.error('[onboarding] saveOnboardingRecipe failed:', e)
      setSaveError('Error al guardar el recetario. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivitiesSave(overrides: { name: string; monthly_goal: number }[]) {
    setSaving(true)
    setSaveError(null)
    try {
      await saveOnboardingActivities(overrides)
      router.push('/dashboard')
      router.refresh()
    } catch (e) {
      console.error('[onboarding] saveOnboardingActivities failed:', e)
      setSaveError('Error al guardar las actividades. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-xl space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2 justify-center">
        {([1, 2, 3] as WizardStep[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
              s === step
                ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(0,217,255,0.4)]'
                : s < step
                ? 'bg-success/20 text-success border border-success/30'
                : 'bg-muted text-muted-foreground'
            }`}>
              {s < step ? '✓' : s}
            </div>
            {s < 3 && (
              <div className={`h-px w-12 transition-all ${s < step ? 'bg-success/40' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center">
          {saveError}
        </div>
      )}

      {/* Steps */}
      {step === 1 && <StepWelcome userName={userName} onNext={() => setStep(2)} />}
      {step === 2 && <StepRecipe onSave={handleRecipeSave} saving={saving} />}
      {step === 3 && <StepActivities onSave={handleActivitiesSave} saving={saving} />}
    </div>
  )
}
