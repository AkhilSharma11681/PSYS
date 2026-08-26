import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createCamera } from '@/lib/enrollment/cameras'

export default async function CamerasPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('institution_id', user.institution_id)
    .order('name')

  const { data: cameras, error } = await supabase
    .from('cameras')
    .select('id, host, stream_path, credential_ref, label, is_active, rooms(name)')
    .eq('institution_id', user.institution_id)
    .order('label')

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Cameras</h1>

      <h2 className="font-medium mb-2">Register Camera</h2>
      <p className="text-sm text-gray-500 mb-2">
        <code>credential_ref</code> must match an env var on camera-service
        (e.g. ref <code>camera_1_creds</code> → env <code>CAMERA_1_CREDS=user:pass</code>).
        The raw credential is never stored here.
      </p>
      <form action={createCamera} className="space-y-3 mb-8">
        <div>
          <label className="block text-sm mb-1">Room</label>
          <select name="room_id" required className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="">Select room...</option>
            {rooms?.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Host (IP:port)</label>
          <input
            name="host"
            placeholder="192.168.1.42:8080"
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Stream Path</label>
          <input
            name="stream_path"
            placeholder="/h264_ulaw.sdp"
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Credential Ref</label>
          <input
            name="credential_ref"
            placeholder="camera_1_creds"
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Label</label>
          <input
            name="label"
            placeholder="primary"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="bg-black text-white px-4 py-2 rounded-md text-sm">
          Register Camera
        </button>
      </form>

      <h2 className="font-medium mb-2">Registered Cameras</h2>
      {error && <p className="text-red-500 text-sm">{error.message}</p>}
      {cameras && cameras.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {cameras.map((c: any) => (
            <li key={c.id} className="border-b pb-2">
              <span className="font-medium">{c.label}</span>
              {' — '}{c.rooms?.name} — {c.host}{c.stream_path}
              {' · ref: '}{c.credential_ref}
              {' · '}{c.is_active ? 'active' : 'inactive'}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No cameras registered yet.</p>
      )}
    </div>
  )
}
