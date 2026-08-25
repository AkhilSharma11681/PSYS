import { login } from '@/lib/auth/actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="p-8 max-w-sm mx-auto mt-20">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <form action={login} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            name="email"
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            name="password"
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-500">{decodeURIComponent(error)}</p>}
        <button
          type="submit"
          className="w-full bg-black text-white px-4 py-2 rounded-md text-sm"
        >
          Sign in
        </button>
      </form>
    </div>
  )
}
