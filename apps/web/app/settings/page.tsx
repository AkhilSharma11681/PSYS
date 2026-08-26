import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { updateAttendanceConfig } from '@/lib/enrollment/config'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  const { data: config } = await supabase
    .from('attendance_config')
    .select('*')
    .eq('institution_id', user.institution_id)
    .eq('is_active', true)
    .single()

  if (!config) {
    return <div className="p-8">No attendance config found for this institution.</div>
  }

  return (
    <div className="p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Attendance Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Spec Section 5, Phase E — these thresholds drive finalization
        (quorum detection, presence scoring, gap-check). Changes apply to
        future session finalizations only.
      </p>
      <form action={updateAttendanceConfig} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">
            Present threshold (0-1) — min presence_score to mark 'present'
          </label>
          <input
            type="number" step="0.01" min="0" max="1"
            name="present_threshold" defaultValue={config.present_threshold}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">
            Left-early threshold (0-1)
          </label>
          <input
            type="number" step="0.01" min="0" max="1"
            name="left_early_threshold" defaultValue={config.left_early_threshold}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">
            Min valid observations — below this, result is 'uncertain'
          </label>
          <input
            type="number" step="1" min="0"
            name="min_valid_observations" defaultValue={config.min_valid_observations}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">
            Max gap minutes — gap beyond this marks 'left_early'
          </label>
          <input
            type="number" step="1" min="0"
            name="max_gap_minutes" defaultValue={config.max_gap_minutes}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">
            Quorum fraction (0-1) — fraction of roster needed to start counting a session as "in session"
          </label>
          <input
            type="number" step="0.01" min="0" max="1"
            name="quorum_fraction" defaultValue={config.quorum_fraction}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">
            Min quorum count — absolute floor, whichever is higher wins
          </label>
          <input
            type="number" step="1" min="0"
            name="min_quorum_count" defaultValue={config.min_quorum_count}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">
            Capture buffer minutes — extra capture window before/after scheduled time
          </label>
          <input
            type="number" step="1" min="0"
            name="capture_buffer_minutes" defaultValue={config.capture_buffer_minutes}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">
            Dispute window (hours) — how long after finalization a dispute can be filed
          </label>
          <input
            type="number" step="1" min="0"
            name="dispute_window_hours" defaultValue={config.dispute_window_hours}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded-md text-sm"
        >
          Save Settings
        </button>
      </form>
    </div>
  )
}
