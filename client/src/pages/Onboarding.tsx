import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'

const TOTAL_STEPS = 3

export default function Onboarding() {
  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    whatsapp: user?.whatsapp || '',
  })

  const progress = (step / TOTAL_STEPS) * 100

  const handleNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  const handleBack = () => setStep((s) => Math.max(s - 1, 1))

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const { data } = await api.put('/users/me', form)
      updateUser(data)
      navigate('/dashboard')
    } catch {
      // Keep on page, show error
    } finally {
      setLoading(false)
    }
  }

  return (
    <main id="main-content" className="min-h-dvh flex flex-col px-6 py-8 page-enter">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Step {step} of {TOTAL_STEPS}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div
          className="h-2 bg-navy-muted rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-label={`Onboarding progress: step ${step} of ${TOTAL_STEPS}`}
        >
          <div
            className="h-full bg-gradient-to-r from-teal to-accent rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        {/* Step 1 — Name */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-white mb-2">What's your name?</h1>
            <p className="text-gray-400 mb-6">This is how your group members will see you.</p>
            <label htmlFor="name-input" className="block text-sm font-medium text-gray-300 mb-2">
              Display name
            </label>
            <input
              id="name-input"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Sara Khan"
              autoComplete="name"
              className="input-field mb-4"
              autoFocus
            />
          </div>
        )}

        {/* Step 2 — Phone */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-white mb-2">Your phone number</h1>
            <p className="text-gray-400 mb-6">
              So group members can call you directly from the dashboard.
            </p>
            <label htmlFor="phone-input" className="block text-sm font-medium text-gray-300 mb-2">
              Phone number <span className="text-gray-500">(optional)</span>
            </label>
            <input
              id="phone-input"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
              autoComplete="tel"
              className="input-field mb-4"
              autoFocus
            />
          </div>
        )}

        {/* Step 3 — WhatsApp */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-white mb-2">WhatsApp number</h1>
            <p className="text-gray-400 mb-6">
              Link your WhatsApp to use the LocationCircle bot — check locations,
              pause sharing, and more without opening the app.
            </p>
            <label htmlFor="whatsapp-input" className="block text-sm font-medium text-gray-300 mb-2">
              WhatsApp number <span className="text-gray-500">(optional)</span>
            </label>
            <input
              id="whatsapp-input"
              type="tel"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="+91 98765 43210"
              autoComplete="tel"
              className="input-field mb-4"
              autoFocus
            />
            <div className="p-3 rounded-xl bg-teal/10 border border-teal/20 text-sm text-teal-light">
              💬 You can text the bot: <em>"Where is everyone?"</em> or <em>"Pause my location"</em>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 max-w-sm mx-auto w-full">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="btn-ghost flex-1 border border-white/10 rounded-xl"
          >
            Back
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={step === 1 && !form.name.trim()}
            className="btn-primary flex-1"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? 'Setting up…' : 'Get started →'}
          </button>
        )}
      </div>

      {/* Skip */}
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="text-sm text-gray-500 hover:text-gray-300 text-center mt-4 mx-auto block transition-colors"
      >
        Skip for now
      </button>
    </main>
  )
}
