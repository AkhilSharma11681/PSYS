import Link from 'next/link'
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
    <div className="page-shell">
      <div className="page-inner">
        <h1 className="text-2xl font-semibold mb-6">Cameras</h1>

        <h2 className="font-medium mb-2">Register Camera</h2>
        <form action={createCamera} className="space-y-3 mb-8">
          <div className="mb-4">
            <label className="block text-sm mb-1">Room</label>
            <select name="room_id" required className="field-input">
              <option value="">Select room...</option>
              {rooms?.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1">Host (IP:port)</label>
            <input
              name="host"
              placeholder="192.168.1.42:8080"
              required
              className="field-input"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1">Stream Path</label>
            <input
              name="stream_path"
              placeholder="/h264_ulaw.sdp"
              required
              className="field-input"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1">Credential Ref</label>
            <input
              name="credential_ref"
              placeholder="camera_1_creds"
              required
              className="field-input"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm mb-1">Label</label>
            <input
              name="label"
              placeholder="primary"
              className="field-input"
            />
          </div>

          <div className="mb-6">
            <button type="submit" className="btn-primary">
              Register Camera
            </button>
          </div>
        </form>

        <h2 className="font-medium mb-2">Registered Cameras</h2>
        {error && <p className="text-red-500 text-sm">{error.message}</p>}
        {cameras && cameras.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {cameras.map((c: any) => (
              <li key={c.id} className="border-b pb-2">
                <span className="font-medium">{c.label}</span>
                <span> — {c.rooms?.name} — {c.host}{c.stream_path}</span>
                <span> · ref: {c.credential_ref} · {c.is_active ? 'active' : 'inactive'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No cameras registered yet.</p>
        )}
      </div>
    </div>
  )
}