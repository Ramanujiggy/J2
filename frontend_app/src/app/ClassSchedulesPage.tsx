// /profile/classes — full-page editor for the user's recurring class schedule.
//
// Layout:
//   - Page title + back link
//   - Notification settings sub-card (3 category toggles + permission CTA)
//   - 2×n grid of class tiles + a copper-dashed "+ Add class" tile (Atoms pattern)
//   - Editor modal opens for new/edit

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, COPPER_BORDER,
  PALE_YELLOW, SURFACE_2, SURFACE_2_BORDER, FONT_EDITORIAL, GLOW_SOFT,
} from '../lib/theme.ts';
import {
  fetchSubscriptionState,
  setCategories,
  unsubscribeThisDevice,
  getPermission,
  type SubscriptionCategories,
} from '../lib/pushClient.ts';
import { detectTimezone, formatScheduleSummary } from '../lib/timeUtils.ts';
import NotificationPermissionPrimer from '../components/NotificationPermissionPrimer.tsx';
import ClassScheduleEditor from '../components/ClassScheduleEditor.tsx';
import PageContent from '../components/PageContent.tsx';
import type { ClassSchedule, ClassScheduleInput, ClassSchedulesResponse, ClassScheduleResponse } from '../types/api.ts';

const CATEGORY_LABELS: Record<keyof SubscriptionCategories, string> = {
  pre_class: 'Pre-class focus',
  intention_check: 'Post-class check-in',
  drive_home_log: 'Drive-home log',
};

export default function ClassSchedulesPage() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [primerOpen, setPrimerOpen] = useState(false);
  const [editing, setEditing] = useState<ClassSchedule | 'new' | null>(null);
  const [subState, setSubState] = useState<{ subscribed: boolean; categories: SubscriptionCategories }>({
    subscribed: false,
    categories: { pre_class: true, intention_check: true, drive_home_log: true },
  });

  const loadSchedules = useCallback(async () => {
    try {
      const res = await api.get<ClassSchedulesResponse>('/api/class-schedules');
      setSchedules(res.schedules ?? []);
    } catch {
      setSchedules([]);
    }
  }, []);

  const loadSubState = useCallback(async () => {
    try {
      const state = await fetchSubscriptionState();
      setSubState(state);
    } catch {
      // server not configured / offline — leave defaults
    }
  }, []);

  // First-load: sync the user's IANA timezone to the backend so the scheduler
  // can convert UTC ticks correctly. Cheap PATCH, fire-and-forget.
  useEffect(() => {
    const tz = detectTimezone();
    api.patch('/api/profile/timezone', { timezone: tz }).catch(() => {/* no-op */});
  }, []);

  useEffect(() => {
    void loadSchedules();
    void loadSubState();
    setLoading(false);
  }, [loadSchedules, loadSubState]);

  const handleSave = async (rows: ClassScheduleInput[], existing: ClassSchedule | null) => {
    if (existing) {
      // PATCH the single row.
      await api.patch<ClassScheduleResponse>(`/api/class-schedules/${existing.id}`, rows[0]);
    } else {
      // Multi-day create — POST one row per day so users can select e.g. Mon/Wed/Fri at once.
      for (const row of rows) {
        await api.post<ClassScheduleResponse>('/api/class-schedules', row);
      }
    }
    await loadSchedules();
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this class from your schedule?')) return;
    await api.delete<void>(`/api/class-schedules/${id}`);
    await loadSchedules();
    setEditing(null);
  };

  const handleCategoryToggle = async (key: keyof SubscriptionCategories) => {
    const next = { ...subState.categories, [key]: !subState.categories[key] };
    setSubState(s => ({ ...s, categories: next }));
    try {
      const updated = await setCategories({ [key]: next[key] });
      setSubState(s => ({ ...s, categories: updated }));
    } catch {
      // revert on error
      setSubState(s => ({ ...s, categories: subState.categories }));
    }
  };

  const handleDisableAll = async () => {
    if (!confirm('Stop receiving notifications on this device?')) return;
    await unsubscribeThisDevice();
    await loadSubState();
  };

  const permission = getPermission();
  const needsEnable = !subState.subscribed || permission === 'default' || permission === 'denied';

  return (
    <PageContent ready={!loading}>
      <div className="mx-auto max-w-2xl px-4 sm:px-6" style={{ paddingTop: 16, paddingBottom: 32 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <button
            onClick={() => navigate('/profile')}
            aria-label="Back to profile"
            style={{
              padding: 8, borderRadius: 10,
              background: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`,
              color: 'rgba(242,228,168,0.6)', cursor: 'pointer',
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <h1
            style={{
              fontFamily: FONT_EDITORIAL, fontSize: 28, color: PALE_YELLOW, textShadow: GLOW_SOFT,
            }}
          >
            Class times
          </h1>
        </div>

        {/* Notification settings sub-card */}
        <div
          style={{
            backgroundColor: CARD_BG,
            border: `1px solid ${CARD_GLOW_BORDER}`,
            boxShadow: CARD_GLOW,
            borderRadius: 18,
            padding: 22,
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: COPPER, marginBottom: 12,
            }}
          >
            ◇ Notifications
          </p>

          {needsEnable ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ color: 'rgba(242,228,168,0.7)', fontSize: 14 }}>
                Three quiet pings around each class. Off right now.
              </p>
              <button
                onClick={() => setPrimerOpen(true)}
                style={{
                  backgroundColor: COPPER, color: '#fff',
                  fontSize: 13, fontWeight: 600, padding: '8px 14px',
                  borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                }}
              >
                Enable
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {(Object.keys(CATEGORY_LABELS) as Array<keyof SubscriptionCategories>).map((key) => {
                  const active = subState.categories[key];
                  return (
                    <button
                      key={key}
                      onClick={() => void handleCategoryToggle(key)}
                      style={{
                        textAlign: 'left',
                        backgroundColor: SURFACE_2,
                        border: `1px solid ${active ? COPPER_BORDER : SURFACE_2_BORDER}`,
                        borderRadius: 12, padding: '12px 14px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ color: PALE_YELLOW, fontSize: 14, fontWeight: 600 }}>
                        {CATEGORY_LABELS[key]}
                      </span>
                      <div
                        aria-hidden
                        style={{
                          width: 36, height: 20, borderRadius: 999, position: 'relative',
                          backgroundColor: active ? COPPER : 'rgba(255,255,255,0.10)',
                          border: `1px solid ${active ? COPPER_BORDER : 'rgba(255,255,255,0.12)'}`,
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute', top: 2, left: active ? 17 : 2,
                            width: 14, height: 14, borderRadius: '50%',
                            backgroundColor: active ? PALE_YELLOW : 'rgba(255,255,255,0.6)',
                            transition: 'left 180ms ease',
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => void handleDisableAll()}
                style={{
                  background: 'transparent', color: 'rgba(255,140,120,0.65)',
                  fontSize: 12, padding: 0, cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,140,120,0.4)',
                }}
              >
                Stop notifications on this device
              </button>
            </>
          )}
        </div>

        {/* 2×n grid of class tiles + Add tile */}
        <p
          style={{
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: COPPER, marginBottom: 12,
          }}
        >
          ◇ Schedule
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          {schedules.map((s) => (
            <button
              key={s.id}
              onClick={() => setEditing(s)}
              style={{
                textAlign: 'left',
                backgroundColor: CARD_BG,
                border: `1px solid ${CARD_GLOW_BORDER}`,
                boxShadow: CARD_GLOW,
                borderRadius: 14,
                padding: '16px 14px',
                cursor: 'pointer',
                minHeight: 96,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}
            >
              <p
                style={{
                  color: PALE_YELLOW, fontSize: 16, fontWeight: 600, fontFamily: FONT_EDITORIAL,
                  marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {s.name}
              </p>
              <p style={{ color: 'rgba(196,145,95,0.85)', fontSize: 12, letterSpacing: '0.04em' }}>
                {formatScheduleSummary(s.day_of_week, s.start_time, s.duration_min)}
              </p>
            </button>
          ))}

          {/* Add tile (always last) */}
          <button
            onClick={() => setEditing('new')}
            style={{
              textAlign: 'center',
              background: 'transparent',
              border: `1.5px dashed rgba(196,145,95,0.45)`,
              borderRadius: 14,
              padding: '16px 14px',
              cursor: 'pointer',
              minHeight: 96,
              color: 'rgba(196,145,95,0.85)',
              fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            + Add class
          </button>
        </div>

        {/* Editor modal */}
        {editing && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)', padding: 16,
            }}
            onClick={() => setEditing(null)}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520 }}>
              <ClassScheduleEditor
                initial={editing === 'new' ? undefined : editing}
                isEdit={editing !== 'new'}
                onSave={(rows) => handleSave(rows, editing === 'new' ? null : editing)}
                onDelete={editing === 'new' ? undefined : () => handleDelete(editing.id)}
                onCancel={() => setEditing(null)}
              />
            </div>
          </div>
        )}

        <NotificationPermissionPrimer
          open={primerOpen}
          onClose={() => setPrimerOpen(false)}
          onSubscribed={() => void loadSubState()}
        />
      </div>
    </PageContent>
  );
}
