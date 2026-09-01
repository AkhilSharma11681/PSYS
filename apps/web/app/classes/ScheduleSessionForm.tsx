'use client'

import { scheduleClassSession } from '@/lib/enrollment/classes'

export default function ScheduleSessionForm({ classId }: { classId: string }) {
  return (
    <form action={scheduleClassSession.bind(null, classId)}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="field-label">Scheduled Start</label>
          <input
            type="datetime-local"
            name="scheduled_start"
            required
            className="field-input"
            onChange={(e) => {
              const end = e.currentTarget.form?.elements.namedItem('scheduled_end') as HTMLInputElement | null
              if (end?.value && new Date(end.value) <= new Date(e.currentTarget.value)) {
                end.setCustomValidity('End must be after start')
              } else if (end) {
                end.setCustomValidity('')
              }
            }}
          />
        </div>
        <div>
          <label className="field-label">Scheduled End</label>
          <input
            type="datetime-local"
            name="scheduled_end"
            required
            className="field-input"
            onChange={(e) => {
              const start = e.currentTarget.form?.elements.namedItem('scheduled_start') as HTMLInputElement | null
              if (start?.value && e.currentTarget.value && new Date(e.currentTarget.value) <= new Date(start.value)) {
                e.currentTarget.setCustomValidity('End must be after start')
              } else {
                e.currentTarget.setCustomValidity('')
              }
            }}
          />
        </div>
        <div className="mt-1">
          <button type="submit" className="btn-primary">Schedule Session</button>
        </div>
      </div>
    </form>
  )
}
