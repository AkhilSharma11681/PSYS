import { getLiveSessionData } from '@/lib/enrollment/attendance'
import LiveSessionDashboard from './LiveSessionDashboard'
import Link from 'next/link'

export const metadata = {
  title: 'Live Session Monitor | PSYS',
}

export default async function LiveSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const initialData = await getLiveSessionData(id)

  return (
    <div className="page-shell">
      <div className="page-inner max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/sessions" className="hover:text-slate-800 transition-colors">
            Sessions
          </Link>
          <span>/</span>
          <Link href={`/sessions/${id}`} className="hover:text-slate-800 transition-colors">
            {(initialData.session.classes as any)?.subject || id.slice(0, 8)}
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">Live Monitor</span>
        </div>

        <LiveSessionDashboard initialData={initialData} />
      </div>
    </div>
  )
}
