import { login } from '@/lib/auth/actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div
      className="min-h-full flex items-center justify-center px-6"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-mono text-xs tracking-widest mb-2" style={{ color: 'var(--accent-good)' }}>
            PSYS
          </p>
          <h1 className="text-xl font-semibold">Sign in to your dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Attendance, automated.
          </p>
        </div>

        <form
          action={login}
          className="space-y-4 p-6 rounded-lg border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div>
            <label className="field-label">Email</label>
            <input type="email" name="email" required className="field-input" />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input type="password" name="password" required className="field-input" />
          </div>
          {error && (
            <p className="text-sm" style={{ color: 'var(--accent-bad)' }}>
              {decodeURIComponent(error)}
            </p>
          )}
          <button type="submit" className="btn-primary w-full">
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
