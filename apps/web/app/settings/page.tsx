import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { updateAttendanceConfig } from '@/lib/enrollment/config'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  // Try institution-specific row first, then fall back to platform default
  // (institution_id IS NULL). Per ARCHITECTURE.md, get_recognition_config()
  // implements the same fallback on the camera-service side; the settings
  // page must show the same effective values the finalization will use.
  const { data: institutionConfig } = await supabase
    .from('attendance_config')
    .select('*')
    .eq('institution_id', user.institution_id)
    .eq('is_active', true)
    .maybeSingle()

  const { data: platformConfig } = await supabase
    .from('attendance_config')
    .select('*')
    .is('institution_id', null)
    .eq('is_active', true)
    .maybeSingle()

  if (!institutionConfig && !platformConfig) {
    return (
      <div className="page-shell">
        <div className="page-inner">
          <p className="page-subtitle">No attendance config found for this institution or platform default.</p>
          <Link href="/" className="link-accent text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  const config = institutionConfig ?? platformConfig
  const usingFallback = !institutionConfig

  return (
    <div className="page-shell">
      <div className="page-inner">
        <h1 className="text-2xl font-semibold mb-4">Attendance Settings</h1>
        {usingFallback && (
          <div className="card">
            <p className="text-sm text-xs px-3 py-2" style={{
              background: 'var(--surface)',
              borderColor: 'var(--accent-warn)',
              color: 'var(--accent-warn)'
            }}>
              No institution-specific config exists — saving will create an override using these defaults.
            </p>
          </div>
        )}

        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Spec Section 5, Phase E — these thresholds drive finalization (quorum detection, presence scoring, gap-check). Changes apply to future session finalizations only.
        </p>

        <div className="card">
          <form action={updateAttendanceConfig} className="space-y-6">
            <div>
              <label className="block text-sm mb-1">
                Present threshold (0-1) — min presence_score to mark 'present'
              </label>
              <input
                type="number" step="0.01" min="0" max="1"
                name="present_threshold" defaultValue={config.present_threshold}
                className="field-input"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Left-early threshold (0-1)
              </label>
              <input
                type="number" step="0.01" min="0" max="1"
                name="left_early_threshold" defaultValue={config.left_early_threshold}
                className="field-input"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Min valid observations — below this, result is 'uncertain'
              </label>
              <input
                type="number" step="1" min="0"
                name="min_valid_observations" defaultValue={config.min_valid_observations}
                className="field-input"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Max gap minutes — gap beyond this marks 'left_early'
              </label>
              <input
                type="number" step="1" min="0"
                name="max_gap_minutes" defaultValue={config.max_gap_minutes}
                className="field-input"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Quorum fraction (0-1) — fraction of roster needed to start counting a session as "in session"
              </label>
              <input
                type="number" step="0.01" min="0" max="1"
                name="quorum_fraction" defaultValue={config.quorum_fraction}
                className="field-input"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Min quorum count — absolute floor, whichever is higher wins
              </label>
              <input
                type="number" step="1" min="0"
                name="min_quorum_count" defaultValue={config.min_quorum_count}
                className="field-input"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Capture buffer minutes — extra capture window before/after scheduled time
              </label>
              <input
                type="number" step="1" min="0"
                name="capture_buffer_minutes" defaultValue={config.capture_buffer_minutes}
                className="field-input"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Dispute window (hours) — how long after finalization a dispute can be filed
              </label>
              <input
                type="number" step="1" min="0"
                name="dispute_window_hours" defaultValue={config.dispute_window_hours}
                className="field-input"
              />
            </div>
            <button type="submit" className="btn-primary">Save Settings</button>
          </form>
        </div>
      </div>
    </div>
  )
}