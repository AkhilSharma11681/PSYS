import Link from 'next/link'
import { getAllDisputes } from '@/lib/enrollment/attendance'
import { resolveDispute } from '@/lib/enrollment/disputes'
import { getCurrentUser } from '@/lib/auth/session'

export const metadata = {
  title: 'Disputes | PSYS',
}

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const statusFilter = params.status || 'pending'
  const user = await getCurrentUser()

  const disputes = await getAllDisputes(statusFilter)

  const TABS = [
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: 'all' },
  ]

  return (
    <div className="page-shell">
      <div className="page-inner">
        <p className="page-eyebrow">Resolution Center</p>
        <h1 className="page-title">Disputes</h1>
        <p className="page-subtitle">Student appeals regarding attendance marking.</p>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b" style={{ borderColor: 'var(--border)' }}>
          {TABS.map(t => (
            <Link
              key={t.value}
              href={`/disputes?status=${t.value}`}
              className={`pb-2 text-sm font-medium ${statusFilter === t.value ? 'border-b-2' : 'opacity-60 hover:opacity-100'}`}
              style={{ borderColor: statusFilter === t.value ? 'var(--foreground)' : 'transparent' }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {disputes.length === 0 ? (
          <p className="ledger-empty">No {statusFilter !== 'all' ? statusFilter : ''} disputes found.</p>
        ) : (
          <div className="space-y-6">
            {disputes.map((d: any) => (
              <div key={d.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{d.students?.full_name}</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                      Roll: {d.students?.roll_number || '—'} &middot;{' '}
                      {user.role === 'student' ? (
                        <span>{d.final_attendance?.class_sessions?.classes?.subject || 'Session'}</span>
                      ) : (
                        <Link href={`/attendance/${d.final_attendance?.session_id}`} className="link-accent">
                          {d.final_attendance?.class_sessions?.classes?.subject || 'Session'}
                        </Link>
                      )}
                      {' on '}
                      {new Date(d.final_attendance?.class_sessions?.scheduled_start).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className={`badge ${d.status === 'pending' ? 'badge-warn' : d.status === 'approved' ? 'badge-good' : 'badge-neutral'}`}>
                      <span className="badge-dot" style={{ background: 'currentColor' }} />
                      {d.status}
                    </span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Issue details */}
                  <div>
                    <div className="mb-4">
                      <h4 className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>System marked</h4>
                      <p className="text-sm font-medium">{d.final_attendance?.status}</p>
                    </div>

                    <div className="mb-4">
                      <h4 className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Student reason</h4>
                      <p className="text-sm card-compact p-3" style={{ border: '1px solid var(--border)' }}>
                        "{d.reason || 'No reason provided.'}"
                      </p>
                    </div>

                    <div className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
                      Filed on {new Date(d.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Evidence & Action */}
                  <div className="flex flex-col h-full">
                    <h4 className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Best Evidence Photo</h4>

                    {d.evidence_photo_url ? (
                      <div className="mb-4 flex-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={d.evidence_photo_url}
                          alt="Evidence"
                          className="max-h-48 rounded object-contain border"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      </div>
                    ) : (
                      <div className="mb-4 flex-1 flex items-center justify-center card-compact rounded border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted)', minHeight: '8rem' }}>
                        No camera evidence available
                      </div>
                    )}

                    {d.status === 'pending' && user.role !== 'student' && (
                      <form action={resolveDispute.bind(null, d.id, d.final_attendance?.session_id)} className="mt-auto card-compact p-3 border flex gap-3 items-center" style={{ borderColor: 'var(--border)' }}>
                        <select name="resolved_status_for_attendance" className="field-input-sm !w-40">
                          <option value="">Keep current status</option>
                          <option value="present">Override to Present</option>
                          <option value="absent">Override to Absent</option>
                          <option value="left_early">Override to Left Early</option>
                        </select>
                        <button type="submit" name="status" value="approved" className="btn-primary-sm whitespace-nowrap">Approve</button>
                        <button type="submit" name="status" value="rejected" className="btn-secondary-sm whitespace-nowrap">Reject</button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}