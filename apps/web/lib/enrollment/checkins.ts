'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_INSTITUTION_ID } from '@/lib/constants'
import { revalidatePath } from 'next/cache'

// Very small CSV parser: expects a header row, comma-separated, no
// embedded commas/quotes in values. Good enough for a device export of
// "student_ref,checked_in_at" pairs; revisit if the real export format
// turns out to be richer once we get device access confirmed.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })
}

export async function importCheckins(formData: FormData) {
  const file = formData.get('file') as File | null

  if (!file || file.size === 0) {
    throw new Error('CSV file is required')
  }

  const text = await file.text()
  const rows = parseCsv(text)

  if (rows.length === 0) {
    throw new Error('CSV appears empty or missing a header row')
  }

  const supabase = createAdminClient()

  let resolved = 0
  let unresolved = 0
  let skipped = 0

  for (const row of rows) {
    const externalRef = row['student_ref']
    const checkedInAt = row['checked_in_at']

    if (!externalRef || !checkedInAt) {
      skipped++
      continue
    }

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('institution_id', DEV_INSTITUTION_ID)
      .eq('roll_number', externalRef)
      .maybeSingle()

    const { error } = await supabase.from('external_checkin_events').insert({
      institution_id: DEV_INSTITUTION_ID,
      source: 'kent',
      external_student_ref: externalRef,
      student_id: student?.id ?? null,
      checked_in_at: checkedInAt,
      raw_payload: row,
    })

    // Unique constraint (source, external_student_ref, checked_in_at) means
    // re-importing the same CSV twice is safe — duplicates just fail silently.
    if (error) {
      if (error.code === '23505') {
        skipped++
        continue
      }
      throw new Error(`Failed to insert check-in row: ${error.message}`)
    }

    if (student?.id) {
      resolved++
    } else {
      unresolved++
    }
  }

  revalidatePath('/checkins')
  return { resolved, unresolved, skipped }
}
