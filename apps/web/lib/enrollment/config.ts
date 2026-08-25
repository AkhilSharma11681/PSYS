'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// Spec Section 5, Phase E: "Thresholds are read from attendance_config
// -- never hardcoded -- so they can be recalibrated per institution
// after the pilot without a code change." This is that recalibration
// surface: a real form instead of raw SQL updates.
export async function updateAttendanceConfig(formData: FormData) {
  const presentThreshold = parseFloat(formData.get('present_threshold') as string)
  const leftEarlyThreshold = parseFloat(formData.get('left_early_threshold') as string)
  const minValidObservations = parseInt(formData.get('min_valid_observations') as string, 10)
  const maxGapMinutes = parseInt(formData.get('max_gap_minutes') as string, 10)
  const quorumFraction = parseFloat(formData.get('quorum_fraction') as string)
  const minQuorumCount = parseInt(formData.get('min_quorum_count') as string, 10)
  const captureBufferMinutes = parseInt(formData.get('capture_buffer_minutes') as string, 10)
  const disputeWindowHours = parseInt(formData.get('dispute_window_hours') as string, 10)

  const values = [
    presentThreshold, leftEarlyThreshold, quorumFraction,
  ]
  if (values.some((v) => isNaN(v) || v < 0 || v > 1)) {
    throw new Error('Threshold and fraction fields must be between 0 and 1')
  }
  const intValues = [
    minValidObservations, maxGapMinutes, minQuorumCount,
    captureBufferMinutes, disputeWindowHours,
  ]
  if (intValues.some((v) => isNaN(v) || v < 0)) {
    throw new Error('Count/duration fields must be non-negative whole numbers')
  }

  const user = await getCurrentUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('attendance_config')
    .update({
      present_threshold: presentThreshold,
      left_early_threshold: leftEarlyThreshold,
      min_valid_observations: minValidObservations,
      max_gap_minutes: maxGapMinutes,
      quorum_fraction: quorumFraction,
      min_quorum_count: minQuorumCount,
      capture_buffer_minutes: captureBufferMinutes,
      dispute_window_hours: disputeWindowHours,
    })
    .eq('institution_id', user.institution_id)
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to update attendance config: ${error.message}`)
  }

  revalidatePath('/settings')
}
