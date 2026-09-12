'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { triggerCameraCapture, getLiveSessionData } from '@/lib/enrollment/attendance'

interface Student {
  id: string
  full_name: string
  roll_number: string
}

interface Observation {
  id: string
  student_id: string | null
  captured_at: string
  similarity_score: number | null
  quality_score: number | null
  match_status: string
  evidence_photo_url: string | null
}

interface Camera {
  id: string
  label: string
  stream_path: string
  is_active: boolean
}

interface LiveSessionProps {
  initialData: {
    session: any
    students: Student[]
    observations: Observation[]
    cameras: Camera[]
  }
}

export default function LiveSessionDashboard({ initialData }: LiveSessionProps) {
  const [data, setData] = useState(initialData)
  const [selectedCamera, setSelectedCamera] = useState<string>(
    initialData.session.camera_id || initialData.cameras[0]?.id || ''
  )
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastCaptureResult, setLastCaptureResult] = useState<any>(null)
  const [autoPoll, setAutoPoll] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isPending, startTransition] = useTransition()

  // Keep state in sync with server-side prop updates
  useEffect(() => {
    setData(initialData)
  }, [initialData])

  // Polling loop for live updates
  useEffect(() => {
    if (!autoPoll) return
    const interval = setInterval(async () => {
      try {
        const fresh = await getLiveSessionData(data.session.id)
        if (fresh) {
          setData(fresh)
          setLastUpdated(new Date())
        }
      } catch (err) {
        console.error('Failed to poll session data', err)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [autoPoll, data.session.id])

  // Calculate live student status from observations
  const studentStatusMap = React.useMemo(() => {
    const map = new Map<
      string,
      {
        status: 'present' | 'low_confidence' | 'absent'
        lastSeen: string | null
        confidence: number | null
        quality: number | null
        matchCount: number
      }
    >()

    data.students.forEach((s) => {
      map.set(s.id, {
        status: 'absent',
        lastSeen: null,
        confidence: null,
        quality: null,
        matchCount: 0,
      })
    })

    data.observations.forEach((obs) => {
      if (obs.student_id && map.has(obs.student_id)) {
        const curr = map.get(obs.student_id)!
        if (obs.match_status === 'matched') {
          curr.matchCount += 1
          if (curr.status !== 'present') {
            curr.status = 'present'
            curr.lastSeen = obs.captured_at
            curr.confidence = obs.similarity_score
            curr.quality = obs.quality_score
          }
        } else if (obs.match_status === 'low_confidence' && curr.status === 'absent') {
          curr.status = 'low_confidence'
          curr.lastSeen = obs.captured_at
          curr.confidence = obs.similarity_score
          curr.quality = obs.quality_score
        }
      }
    })

    return map
  }, [data.students, data.observations])

  const presentCount = Array.from(studentStatusMap.values()).filter((s) => s.status === 'present').length
  const lowConfidenceCount = Array.from(studentStatusMap.values()).filter((s) => s.status === 'low_confidence').length
  const absentCount = data.students.length - presentCount - lowConfidenceCount
  const attendancePercentage = data.students.length > 0 ? Math.round((presentCount / data.students.length) * 100) : 0

  const handleManualCapture = async () => {
    if (!selectedCamera) return
    setIsCapturing(true)
    setLastCaptureResult(null)

    try {
      const res = await triggerCameraCapture(selectedCamera, data.session.id)
      if (res.success) {
        setLastCaptureResult({
          type: 'success',
          faces: res.data?.recognition?.faces_detected ?? 0,
          results: res.data?.recognition?.results ?? [],
          time: new Date().toLocaleTimeString(),
        })
        const fresh = await getLiveSessionData(data.session.id)
        if (fresh) {
          setData(fresh)
        }
      } else {
        setLastCaptureResult({
          type: 'error',
          message: res.error,
          time: new Date().toLocaleTimeString(),
        })
      }
    } catch (e: any) {
      setLastCaptureResult({
        type: 'error',
        message: e.message || 'Capture failed',
        time: new Date().toLocaleTimeString(),
      })
    } finally {
      setIsCapturing(false)
      setLastUpdated(new Date())
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card: Title, Status, and Controls */}
      <div className="card p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                LIVE MONITOR
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Session ID: {data.session.id.slice(0, 8)}...
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              {data.session.classes?.subject || 'Classroom Session'}
            </h1>
            <p className="text-sm text-slate-500">
              Live AI vision roll-call & autonomous verification
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Camera Selector */}
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="field-input text-xs py-1.5 px-3 rounded-lg border-slate-300"
              disabled={isCapturing}
            >
              {data.cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  📹 {c.label} ({c.stream_path.split('@')[1] || c.stream_path})
                </option>
              ))}
            </select>

            {/* Trigger Button */}
            <button
              onClick={handleManualCapture}
              disabled={isCapturing || !selectedCamera}
              className={`btn-primary flex items-center gap-2 text-sm font-medium py-2 px-4 shadow-sm transition-all ${
                isCapturing ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02]'
              }`}
            >
              {isCapturing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Processing Feed...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Trigger Target Capture
                </>
              )}
            </button>

            <Link
              href={`/sessions/${data.session.id}`}
              className="btn-secondary text-sm py-2 px-3 hover:bg-slate-50"
            >
              View Full Session ↗
            </Link>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Attendance Rate</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-sans tabular-nums text-slate-900">{attendancePercentage}%</span>
              <span className="text-xs text-slate-400 font-medium">({presentCount}/{data.students.length})</span>
            </div>
          </div>

          <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Present</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-sans tabular-nums text-emerald-600">{presentCount}</span>
              <span className="text-xs text-emerald-600 font-medium">Verified Face</span>
            </div>
          </div>

          <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Low Confidence</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-sans tabular-nums text-amber-600">{lowConfidenceCount}</span>
              <span className="text-xs text-amber-600 font-medium">Needs Light</span>
            </div>
          </div>

          <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-100">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Unseen / Absent</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-sans tabular-nums text-rose-600">{absentCount}</span>
              <span className="text-xs text-rose-500 font-medium">Not in frame</span>
            </div>
          </div>
        </div>

        {/* Capture notification banner */}
        {lastCaptureResult && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm flex items-center justify-between transition-all ${
              lastCaptureResult.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{lastCaptureResult.type === 'success' ? '🎯' : '⚠️'}</span>
              <span>
                {lastCaptureResult.type === 'success'
                  ? `Capture successful at ${lastCaptureResult.time}: Detected ${lastCaptureResult.faces} face(s).`
                  : `Capture error: ${lastCaptureResult.message}`}
              </span>
            </div>
            <button
              onClick={() => setLastCaptureResult(null)}
              className="text-xs font-bold opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Grid & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Classroom Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Enrolled Student Roster</h2>
                <p className="text-xs text-slate-500">Autonomous presence detection state for this session</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoPoll(!autoPoll)}
                  className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                    autoPoll
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                  title="Toggle automatic live sync"
                >
                  <span className="flex h-2 w-2 relative">
                    {autoPoll && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        autoPoll ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    ></span>
                  </span>
                  <span>{autoPoll ? 'Live Syncing' : 'Sync Paused'}</span>
                </button>
              </div>
            </div>

            {data.students.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No students enrolled in this session's class.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.students.map((student) => {
                  const statusInfo = studentStatusMap.get(student.id) || {
                    status: 'absent',
                    lastSeen: null,
                    confidence: null,
                    quality: null,
                    matchCount: 0,
                  }

                  const isPresent = statusInfo.status === 'present'
                  const isLowConf = statusInfo.status === 'low_confidence'

                  return (
                    <div
                      key={student.id}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        isPresent
                          ? 'bg-emerald-50/40 border-emerald-200 shadow-sm'
                          : isLowConf
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-900 text-sm">{student.full_name}</p>
                          <p className="text-xs font-mono text-slate-500">{student.roll_number}</p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isPresent
                              ? 'bg-emerald-100 text-emerald-800'
                              : isLowConf
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isPresent ? '✓ Present' : isLowConf ? '⚠️ Low Conf' : '○ Absent'}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Matches:{' '}
                          <strong className="text-slate-700 font-sans tabular-nums">
                            {statusInfo.matchCount}
                          </strong>
                        </span>
                        {statusInfo.confidence && (
                          <span className="font-mono">
                            {(statusInfo.confidence * 100).toFixed(1)}% match
                          </span>
                        )}
                        {statusInfo.lastSeen && (
                          <span className="text-[11px] text-slate-400">
                            {new Date(statusInfo.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Recent Vision Feed / Observation Log */}
        <div className="space-y-4">
          <div className="card p-5 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Vision Activity Feed</h2>
            <p className="text-xs text-slate-500 mb-4">Latest observation events from camera stream</p>

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {data.observations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No camera observations yet.</p>
              ) : (
                data.observations.map((obs) => {
                  const student = data.students.find((s) => s.id === obs.student_id)
                  const isMatch = obs.match_status === 'matched'
                  const isPoor = obs.match_status === 'poor_quality'
                  const isNoFace = obs.match_status === 'no_face'

                  return (
                    <div
                      key={obs.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/80 text-xs transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-semibold ${
                            isMatch
                              ? 'text-emerald-700'
                              : isPoor
                              ? 'text-amber-700'
                              : isNoFace
                              ? 'text-slate-500'
                              : 'text-blue-700'
                          }`}
                        >
                          {isMatch
                            ? `✓ ${student?.full_name || 'Matched'}`
                            : isPoor
                            ? '⚠️ Poor Quality Face'
                            : isNoFace
                            ? '○ No Face Detected'
                            : `⚡ ${obs.match_status}`}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {new Date(obs.captured_at).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        {obs.similarity_score !== null && (
                          <span>
                            Conf:{' '}
                            <strong className="text-slate-700 font-mono">
                              {(obs.similarity_score * 100).toFixed(1)}%
                            </strong>
                          </span>
                        )}
                        {obs.quality_score !== null && (
                          <span>
                            Quality:{' '}
                            <strong className="text-slate-700 font-mono">
                              {obs.quality_score.toFixed(2)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
