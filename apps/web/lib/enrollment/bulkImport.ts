'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { DEV_INSTITUTION_ID } from '@/lib/constants'
import { revalidatePath } from 'next/cache'
import { checkRateLimit } from '@/lib/rate-limit'

// Spec Phase B, step 2: "Admin bulk-uploads students (CSV + photos)."
// This covers the CSV half (full_name, roll_number). Photos are added
// per-student afterward via the existing Add Photo flow -- mapping
// photos to CSV rows in one pass adds real complexity (file-matching by
// name/roll number) for a first version; revisit if a real institution's
// onboarding flow makes that friction significant enough to justify it.
//
// No unique constraint exists on students.roll_number (verified before
// building this), so duplicates are checked explicitly here rather than
// relying on a DB-level unique-violation catch like importCheckins does.
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

export async function importStudents(formData: FormData) {
  checkRateLimit(`importStudents:${DEV_INSTITUTION_ID}`, 5, 60_000)

  const file = formData.get('file') as File | null
  const consentConfirmed = formData.get('consent_confirmed') === 'on'

  if (!file || file.size === 0) {
    throw new Error('CSV file is required')
  }
  if (!consentConfirmed) {
    throw new Error('You must confirm consent has been obtained for all students in this file (spec Section 9)')
  }

  const text = await file.text()
  const rows = parseCsv(text)

  if (rows.length === 0) {
    throw new Error('CSV appears empty or missing a header row')
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('students')
    .select('roll_number')
    .eq('institution_id', DEV_INSTITUTION_ID)

  const existingRollNumbers = new Set(
    (existing || []).map((s) => s.roll_number).filter(Boolean)
  )

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    const fullName = row['full_name']?.trim()
    const rollNumber = row['roll_number']?.trim() || null

    if (!fullName) {
      skipped++
      continue
    }
    if (rollNumber && existingRollNumbers.has(rollNumber)) {
      skipped++
      continue
    }

    const { error } = await supabase.from('students').insert({
      institution_id: DEV_INSTITUTION_ID,
      full_name: fullName,
      roll_number: rollNumber,
      status: 'active',
      consent_given: true,
      consent_recorded_at: new Date().toISOString(),
    })

    if (error) {
      errors.push(`${fullName}: ${error.message}`)
    } else {
      created++
      if (rollNumber) existingRollNumbers.add(rollNumber)
    }
  }

  revalidatePath('/students')
  return { created, skipped, errors }
}
