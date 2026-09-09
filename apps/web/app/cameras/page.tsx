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
      <div className="page-inner max-w-4xl">
        <p className="page-eyebrow">Infrastructure</p>
        <h1 className="page-title">Cameras</h1>
        <p className="page-subtitle">Configure RTSP edge streams and hardware mapping for classroom vision roll-call.</p>

        <div className="card p-6 mb-8">
          <h2 className="text-base font-semibold mb-4 text-slate-900">Register Camera</h2>
          <form action={createCamera} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Room</label>
              <select name="room_id" required className="field-input">
                <option value="">Select room...</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Label</label>
              <input
                name="label"
                placeholder="Front Overhead Camera"
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Host (IP:port)</label>
              <input
                name="host"
                placeholder="172.20.10.1:554"
                required
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Stream Path</label>
              <input
                name="stream_path"
                placeholder="/stream"
                required
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Credential Ref</label>
              <input
                name="credential_ref"
                placeholder="default_creds"
                required
                className="field-input"
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <button type="submit" className="btn-primary">
                Register Camera
              </button>
            </div>
          </form>
        </div>

        <h2 className="text-base font-semibold mb-3 text-slate-900">Registered Cameras</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error.message}</p>}
        {cameras && cameras.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="ledger">
              <div className="ledger-head" style={{ gridTemplateColumns: '1.5fr 1fr 2fr 1fr' }}>
                <div>Label</div>
                <div>Room</div>
                <div>RTSP Endpoint</div>
                <div>Status</div>
              </div>
              {cameras.map((c: any) => (
                <div key={c.id} className="ledger-row" style={{ gridTemplateColumns: '1.5fr 1fr 2fr 1fr' }}>
                  <div className="text-sm font-semibold text-slate-900">{c.label}</div>
                  <div className="text-sm text-slate-600">{c.rooms?.name || '—'}</div>
                  <div className="text-xs font-mono text-slate-500">
                    rtsp://{c.host}{c.stream_path}
                  </div>
                  <div>
                    <span className={`badge ${c.is_active ? 'badge-good' : 'badge-neutral'}`}>
                      <span className="badge-dot" style={{ background: 'currentColor' }} />
                      {c.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="ledger-empty">No cameras registered yet.</p>
        )}
      </div>
    </div>
  )
}