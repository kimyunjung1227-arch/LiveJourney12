import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchRaffles,
  createRaffle,
  updateRaffle,
  deleteRaffle,
  startScheduledRaffle,
  completeRaffleNow,
  RAFFLE_START_MIDNIGHT,
  RAFFLE_START_IMMEDIATE,
} from '../api/rafflesSupabase';
import { formatDaysLeftKorean } from '../utils/raffleSchedule';

const BADGE_OPTIONS = ['당첨', '미당첨', '미응모'];

const emptyForm = {
  open: false,
  kind: 'scheduled',
  editingId: null,
  title: '',
  description: '',
  image_url: '',
  days_left: '오픈 예정',
  category: '',
  status_message: '',
  badge: '미응모',
  sort_order: 0,
  duration_days: 7,
};

const AdminRafflesScreen = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const [startPickId, setStartPickId] = useState(null);
  const [endingId, setEndingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ id: null });

  const load = useCallback(async () => {
    const data = await fetchRaffles();
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const scheduled = useMemo(() => rows.filter((r) => r.kind === 'scheduled'), [rows]);
  const ongoing = useMemo(() => rows.filter((r) => r.kind === 'ongoing'), [rows]);
  const completed = useMemo(() => rows.filter((r) => r.kind === 'completed'), [rows]);

  const openCreateScheduled = () => {
    setForm({
      ...emptyForm,
      open: true,
      kind: 'scheduled',
      days_left: '오픈 예정',
      sort_order: 0,
      duration_days: 7,
    });
  };

  const openEdit = (row) => {
    setForm({
      open: true,
      kind: row.kind,
      editingId: row.id,
      title: row.title || '',
      description: row.description || '',
      image_url: row.image_url || '',
      days_left: row.days_left || '',
      category: row.category || '',
      status_message: row.status_message || '',
      badge: row.badge || '미응모',
      sort_order: row.sort_order ?? 0,
      duration_days: Math.max(1, Number(row.duration_days) || 7),
    });
  };

  const closeForm = () => setForm(emptyForm);

  const handleSave = async () => {
    const {
      editingId,
      kind,
      title,
      image_url,
      description,
      days_left,
      category,
      status_message,
      badge,
      sort_order,
      duration_days,
    } = form;
    if (!title.trim()) {
      alert('제목을 입력하세요.');
      return;
    }
    if (!image_url.trim()) {
      alert('이미지 URL을 입력하세요.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await updateRaffle(editingId, {
          kind,
          title,
          image_url,
          description,
          sort_order,
          duration_days,
          ...(kind === 'ongoing' || kind === 'scheduled'
            ? {
                days_left:
                  kind === 'ongoing'
                    ? days_left
                    : (days_left || '').trim() || '오픈 예정',
                category: null,
                status_message: null,
                badge: null,
              }
            : {
                days_left: null,
                category,
                status_message,
                badge,
              }),
        });
        if (res.success) {
          await load();
          closeForm();
        } else {
          alert(res.error || '수정에 실패했습니다.');
        }
      } else {
        const res = await createRaffle({
          title,
          image_url,
          description,
          sort_order,
          duration_days,
          days_left: (days_left || '').trim() || '오픈 예정',
        });
        if (res.success) {
          await load();
          closeForm();
        } else {
          alert(res.error || '등록에 실패했습니다.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openStartPicker = (id) => {
    if (!id) return;
    setStartPickId(id);
  };

  const closeStartPicker = () => setStartPickId(null);

  const runStartWithMode = async (id, mode) => {
    if (!id) return;
    setStartingId(id);
    try {
      const res = await startScheduledRaffle(id, mode);
      if (res.success) {
        closeStartPicker();
        await load();
      } else {
        alert(res.error || '시작에 실패했습니다.');
      }
    } finally {
      setStartingId(null);
    }
  };

  const handleEndRaffle = async (id) => {
    if (!id) return;
    const ok = window.confirm('이 래플을 지금 완료(종료) 처리할까요? 완료된 래플 목록으로 옮겨집니다.');
    if (!ok) return;
    setEndingId(id);
    try {
      const res = await completeRaffleNow(id);
      if (res.success) {
        await load();
      } else {
        alert(res.error || '종료에 실패했습니다.');
      }
    } finally {
      setEndingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    const { success } = await deleteRaffle(id);
    if (success) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm({ id: null });
    } else {
      alert('삭제에 실패했습니다. (Supabase에 raffles 테이블·마이그레이션 적용 및 admin_users에 본인이 등록되어 있는지 확인하세요.)');
    }
  };

  const displayDaysLabel = (r) => {
    if (r.kind === 'ongoing' && r.ends_at) return formatDaysLeftKorean(r.ends_at);
    if ((r.kind === 'ongoing' || r.kind === 'scheduled') && r.days_left) return r.days_left;
    if (r.kind === 'scheduled') return `${Math.max(1, Number(r.duration_days) || 7)}일 래플 예정`;
    return '';
  };

  const renderList = (list, { showStart, showEnd } = {}) => (
    <ul className="space-y-2">
      {list.map((r) => {
        const daysLine = displayDaysLabel(r);
        return (
        <li
          key={r.id}
          className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900">
            <img src={r.image_url} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 dark:text-white line-clamp-2">{r.title}</div>
            <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              정렬 {r.sort_order ?? 0}
              {daysLine ? ` · ${daysLine}` : ''}
              {r.kind === 'completed' && r.badge ? ` · ${r.badge}` : ''}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {showStart && (
                <button
                  type="button"
                  disabled={startingId === r.id || Boolean(startPickId)}
                  onClick={() => openStartPicker(r.id)}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  래플 시작
                </button>
              )}
              {showEnd && (
                <button
                  type="button"
                  disabled={endingId === r.id}
                  onClick={() => handleEndRaffle(r.id)}
                  className="rounded-lg border border-amber-600/80 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                >
                  {endingId === r.id ? '종료 중…' : '래플 종료'}
                </button>
              )}
              <button
                type="button"
                onClick={() => openEdit(r)}
                className="text-xs font-medium text-primary hover:underline"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm({ id: r.id })}
                className="text-xs font-medium text-rose-600 hover:underline"
              >
                삭제
              </button>
            </div>
          </div>
        </li>
        );
      })}
    </ul>
  );

  return (
    <div className="screen-layout min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="뒤로가기"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">래플 관리</h1>
        <div className="w-10" />
      </header>

      <main className="space-y-8 p-4 pb-28">
        <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">
          진행 예정만 등록한 뒤 <strong className="text-gray-800 dark:text-gray-200">래플 시작</strong>에서{' '}
          <strong className="text-gray-800 dark:text-gray-200">지금 시작</strong>(N×24시간) 또는{' '}
          <strong className="text-gray-800 dark:text-gray-200">00시 시작</strong>(서울 달력 1일차 0시~N일차 0시)을 고를 수 있습니다.
          진행 중에는 <strong className="text-gray-800 dark:text-gray-200">래플 종료</strong>로 조기 완료할 수 있고, 기간이 끝나면 자동으로 완료됩니다. RLS 오류 시 Supabase SQL에{' '}
          <code className="rounded bg-gray-200 px-1 text-[12px] dark:bg-gray-700">20260426120000_raffles_schedule_rls.sql</code>{' '}
          을 적용하고, <code className="rounded bg-gray-200 px-1 text-[12px] dark:bg-gray-700">admin_users</code>에 본인{' '}
          <code className="rounded bg-gray-200 px-1 text-[12px] dark:bg-gray-700">user_id</code>를 넣어 주세요.
        </p>

        {loading ? (
          <div className="py-8 text-center text-gray-500">불러오는 중...</div>
        ) : (
          <>
            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-extrabold text-gray-900 dark:text-white">진행 예정 래플</h2>
                <button
                  type="button"
                  onClick={openCreateScheduled}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  추가
                </button>
              </div>
              {scheduled.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 py-6 text-center text-[13px] text-gray-500 dark:border-gray-600">
                  등록된 진행 예정 래플이 없습니다.
                </p>
              ) : (
                renderList(scheduled, { showStart: true })
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-extrabold text-gray-900 dark:text-white">진행 중인 래플</h2>
              </div>
              {ongoing.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 py-6 text-center text-[13px] text-gray-500 dark:border-gray-600">
                  진행 중인 래플이 없습니다. 진행 예정에서 래플 시작을 눌러 주세요.
                </p>
              ) : (
                renderList(ongoing, { showStart: false, showEnd: true })
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-extrabold text-gray-900 dark:text-white">완료된 래플</h2>
              </div>
              {completed.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 py-6 text-center text-[13px] text-gray-500 dark:border-gray-600">
                  완료된 래플이 없습니다.
                </p>
              ) : (
                renderList(completed, { showStart: false })
              )}
            </section>
          </>
        )}
      </main>

      {form.open && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-[16px] font-extrabold text-gray-900 dark:text-gray-50">
                {form.editingId
                  ? '래플 수정'
                  : '진행 예정 래플 추가'}
              </h3>
              <button type="button" onClick={closeForm} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">제목</label>
                <input
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">이미지 URL</label>
                <input
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                  placeholder="https://..."
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">정렬 순서 (작을수록 위)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                  value={form.sort_order}
                  onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
                />
              </div>

              {(form.kind === 'ongoing' || form.kind === 'scheduled') && !form.editingId && (
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                    진행 일수 (N일 래플: 1일차 0시 ~ N일차 0시 종료)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                    value={form.duration_days}
                    onChange={(e) => setForm((p) => ({ ...p, duration_days: Math.max(1, Number(e.target.value) || 7) }))}
                  />
                </div>
              )}

              {form.kind === 'scheduled' && form.editingId && (
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                    진행 일수 (시작 전에만 변경 가능)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                    value={form.duration_days}
                    onChange={(e) => setForm((p) => ({ ...p, duration_days: Math.max(1, Number(e.target.value) || 7) }))}
                  />
                </div>
              )}

              {form.kind === 'ongoing' || form.kind === 'scheduled' ? (
                <>
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">설명</label>
                    <textarea
                      className="min-h-[100px] w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                      {form.kind === 'scheduled' ? '표시 문구 (예: 오픈 예정)' : '남은 기간 표시(수동, 미입력 시 종료일 기준 자동)'}
                    </label>
                    <input
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                      placeholder={form.kind === 'scheduled' ? '오픈 예정' : '예: 5일 남음'}
                      value={form.days_left}
                      onChange={(e) => setForm((p) => ({ ...p, days_left: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">카테고리</label>
                    <input
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                      placeholder="예: 국내/근교 여행"
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">상태 문구</label>
                    <input
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                      placeholder="예: 당첨을 축하드려요."
                      value={form.status_message}
                      onChange={(e) => setForm((p) => ({ ...p, status_message: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">배지</label>
                    <select
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                      value={form.badge}
                      onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))}
                    >
                      {BADGE_OPTIONS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 rounded-full bg-gray-100 py-2.5 text-[13px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSave}
                className={`flex-1 rounded-full py-2.5 text-[13px] font-semibold text-white ${submitting ? 'bg-gray-400' : 'bg-primary hover:bg-primary-dark'}`}
              >
                {submitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {startPickId && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="m-0 text-[16px] font-extrabold text-gray-900 dark:text-gray-50">시작 방식 선택</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-800 dark:text-gray-200">지금 시작</span>: 이 순간부터 설정한 일수만큼
              정확히 N×24시간 후 종료합니다.
              <br />
              <br />
              <span className="font-semibold text-gray-800 dark:text-gray-200">00시 시작</span>: 서울 기준 오늘 0시를 1일차로
              잡고, N일차 0시에 종료합니다.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={startingId === startPickId}
                onClick={() => runStartWithMode(startPickId, RAFFLE_START_IMMEDIATE)}
                className="w-full rounded-xl bg-emerald-600 py-3 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {startingId === startPickId ? '처리 중…' : '지금 시작'}
              </button>
              <button
                type="button"
                disabled={startingId === startPickId}
                onClick={() => runStartWithMode(startPickId, RAFFLE_START_MIDNIGHT)}
                className="w-full rounded-xl border border-gray-300 bg-white py-3 text-[13px] font-bold text-gray-900 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                00시 시작 (서울)
              </button>
              <button
                type="button"
                disabled={startingId === startPickId}
                onClick={closeStartPicker}
                className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm.id && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[320px] rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="m-0 text-[16px] font-extrabold text-gray-900 dark:text-gray-50">래플 삭제</h3>
            <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">이 래플을 삭제할까요?</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ id: null })}
                className="flex-1 rounded-full bg-gray-100 py-2.5 text-[13px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 rounded-full bg-rose-600 py-2.5 text-[13px] font-semibold text-white"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRafflesScreen;
