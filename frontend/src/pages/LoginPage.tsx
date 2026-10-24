import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogIn, UserPlus, ShieldCheck, KeyRound } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'

export default function LoginPage() {
  const { signIn, signUp, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/find'

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    clearError()

    if (!email || !email.includes('@')) {
      setFormError('Please enter a valid email address.')
      return
    }
    if (!password || password.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }
    if (mode === 'signup' && !fullName.trim()) {
      setFormError('Please provide your full name.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        setSuccessMsg('Signed in successfully!')
        setTimeout(() => navigate(from, { replace: true }), 400)
      } else {
        await signUp(email, password, fullName)
        setSuccessMsg('Account created and signed in!')
        setTimeout(() => navigate(from, { replace: true }), 400)
      }
    } catch (err: any) {
      setFormError(err.message || 'Authentication failed. Please check credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick 1-click Demo Fill for Judges
  const fillDemoCredentials = () => {
    setEmail('partfinder.tester.1413@gmail.com')
    setPassword('Password123!')
    setMode('signin')
    setFormError(null)
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          {mode === 'signin' ? 'Sign in to PartFinder' : 'Create an Account'}
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Powered by Supabase Auth with secure HttpOnly sessions
        </p>
      </div>

      <Card>
        {/* Mode Toggle Tabs */}
        <div className="mb-6 flex rounded-lg bg-surface-subtle p-1 border border-line">
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              setFormError(null)
              clearError()
            }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === 'signin'
                ? 'bg-surface text-ink-900 shadow-sm'
                : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setFormError(null)
              clearError()
            }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === 'signup'
                ? 'bg-surface text-ink-900 shadow-sm'
                : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {(formError || error) && (
          <div className="mb-4">
            <Alert tone="error" title="Authentication Error">
              {formError || error}
            </Alert>
          </div>
        )}

        {successMsg && (
          <div className="mb-4">
            <Alert tone="info" title="Success">
              {successMsg}
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1">
                Full Name
              </label>
              <Input
                type="text"
                placeholder="Jane Engineer"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="engineer@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1">
              Password
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-ink-500">Must be at least 6 characters</p>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={isSubmitting}
            icon={mode === 'signin' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          >
            {mode === 'signin' ? 'Sign In' : 'Create Free Account'}
          </Button>
        </form>

        <div className="mt-6 border-t border-line pt-4 text-center">
          <button
            type="button"
            onClick={fillDemoCredentials}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-700 hover:text-accent-800"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Quick Demo: Autofill Verified Credentials
          </button>
        </div>
      </Card>
    </div>
  )
}