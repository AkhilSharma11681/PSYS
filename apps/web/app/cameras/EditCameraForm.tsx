'use client'

import { useState, useTransition, useEffect } from 'react'
import { updateCamera } from '@/lib/enrollment/cameras'

export default function EditCameraForm({
  camera,
  rooms,
}: {
  camera: any
  rooms: any[]
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Handle escape key to close modal
  useEffect(() => {
    if (!isEditing) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditing(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        await updateCamera(camera.id, formData)
        setIsEditing(false)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to update camera')
        }
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setIsEditing(true)
        }}
        className="text-xs font-medium text-blue-600 hover:text-blue-800"
      >
        Edit
      </button>

      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs text-left"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsEditing(false)
            }
          }}
        >
          <div
            className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-camera-title-${camera.id}`}
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h2
                id={`edit-camera-title-${camera.id}`}
                className="text-base font-semibold text-slate-900"
              >
                Edit Camera Configuration
              </h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1 rounded hover:bg-slate-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="field-label">Room</label>
                <select
                  name="room_id"
                  defaultValue={camera.room_id || ''}
                  required
                  className="field-input"
                >
                  <option value="">Select room...</option>
                  {rooms?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">Label</label>
                <input
                  name="label"
                  defaultValue={camera.label || ''}
                  placeholder="Front Overhead Camera"
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">Host (IP:port)</label>
                <input
                  name="host"
                  defaultValue={camera.host}
                  placeholder="172.20.10.1:554"
                  required
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">Stream Path</label>
                <input
                  name="stream_path"
                  defaultValue={camera.stream_path}
                  placeholder="/stream"
                  required
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">Credential Ref</label>
                <input
                  name="credential_ref"
                  defaultValue={camera.credential_ref}
                  placeholder="default_creds"
                  required
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">Rotation (°)</label>
                <select
                  name="rotation_degrees"
                  defaultValue={camera.rotation_degrees || 0}
                  className="field-input"
                >
                  <option value="0">0° (None)</option>
                  <option value="90">90° (Clockwise)</option>
                  <option value="180">180°</option>
                  <option value="270">270° (Counter-clockwise)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn-secondary text-sm"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary text-sm"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
