import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchRaffles, createRaffle, updateRaffle, deleteRaffle } from '../api/rafflesSupabase';
import { uploadImage } from '../api/upload';
import { formatDaysLeftKorean } from '../utils/raffleSchedule';
import { RAFFLE_DURATION_OPTIONS } from '../data/raffleDurations';

const BADGE_OPTIONS = ['당첨', '미당첨', '미응모'];

const emptyForm = {
  open: false,
  kind: 'scheduled',
  editingId: null,
  title: '',
  description: '',
  image_url: '',
  category: '',
  status_message: '',
  badge: '미응모',
  duration_days: 7,
};

const AdminRafflesScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ id: null });

  const load = useCallback(async () => {
    const data = await fetchRaffles();
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const editId = location.state?.openEditId;
    if (!editId || loading || !rows.length) return;
    const r = rows.find((x) => x.id === editId);
    if (r) {
      setForm({
        open: true,
        kind: r.kind,
        editingId: r.id,
        title: r.title || '',
        description: r.description || '',
        image_url: r.image_url || '',
        category: r.category || '',
        status_message: r.status_message || '',
        badge: r.badge || '미응모',
        duration_days: Math.max(1, Number(r.duration_days) || 7),
      });
      navigate('/admin/raffles', { replace: true, state: {} });
    }
  }, [loading, rows, location.state, navigate]);

  const scheduled = useMemo(() => rows.filter((r) => r.kind === 'scheduled'), [rows]);
  const ongoing = useMemo(() => rows.filter((r) => r.kind === 'ongoing'), [rows]);
  const completed = useMemo(() => rows.filter((r) => r.kind === 'completed'), [rows]);

  const openCreateScheduled = () => {
    setForm({
      ...emptyForm,
      open: true,
      kind: 'scheduled',
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
      category: row.category || '',
      status_message: row.status_message || '',
      badge: row.badge || '미응모',
      duration_days: Math.max(1, Number(row.duration_days) || 7),
    });
  };

  const closeForm = () => setForm(emptyForm);

  const onPickImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const res = await uploadImage(file);
      if (res?.success && res.url) {
        setForm((p) => ({ ...p, image_url: res.url }));
      } else {
        alert(res?.message || '이미지 업로드에 실패했습니다.');
      }
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    const { editingId, kind, title, image_url, description, category, status_message, badge, duration_days } = form;
    if (!title.trim()) {
      alert('제목을 입력하세요.');
      return;
    }
    if (!image_url.trim()) {
      alert('이미지 URL을 입력하거나 파일을 업로드하세요.');
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
          duration_days,
          ...(kind === 'ongoing' || kind === 'scheduled'
            ? {
                category: null,
                status_message: null,
                badge: null,
              }
            : {
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
          duration_days,
        });
        if (res.success && res.raffle?.id) {
          await load();
          closeForm();
          navigate(`/admin/raffles/${res.raffle.id}`);
        } else {
          alert(res.error || '등록에 실패했습니다.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    const { success } = await deleteRaffle(id);
    if (success) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm({ id: null });
    } else {
      alert('삭제에 실패했습니다.');
    }
  };

  const displayDaysLabel = (r) => {
    if (r.kind === 'ongoing' && r.ends_at) return formatDaysLeftKorean(r.ends_at);
    if (r.kind === 'scheduled') return `${Math.max(1, Number(r.duration_days) || 7)}일 래플 예정`;
    return '';
  };

  const renderRaffleList = (list) => (
    <ul className="space-y-2">
      {list.map((r) => {
        const daysLine = displayDaysLabel(r);
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => navigate(`/admin/raffles/${r.id}`)}
              className="flex w-full gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-primary/40 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900">
                <img src={r.image_url} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900 dark:text-white line-clamp-2">{r.title}</div>
                <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {daysLine ? daysLine : ''}
                  {r.kind === 'completed' && r.badge ? ` · ${r.badge}` : ''}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs font-medium text-primary">상세 · 시작/종료</span>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openEdit(r);
                    }}
                    className="text-xs font-medium text-gray-600 hover:underline dark:text-gray-300"
                  >
                    빠른 수정
                  </button>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setDeleteConfirm({ id: r.id });
                    }}
                    className="text-xs font-medium text-rose-600 hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <span className="material-symbols-outlined shrink-0 text-gray-400">chevron_right</span>
            </button>
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
          항목을 눌러 상세에서 <strong className="text-gray-800 dark:text-gray-200">시작·종료</strong>를 처리하세요.
          예정 래플을 <strong className="text-gray-800 dark:text-gray-200">00시 종료</strong>로 예약하면 해당 시각 이후 자동 삭제됩니다(
          SQL <code className="rounded bg-gray-200 px-1 text-[12px] dark:bg-gray-700">20260427130000_raffles_close_scheduled_at_ends.sql</code>).
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
                renderRaffleList(scheduled)
              )}
            </section>

            <section>
              <div className="mb-3">
                <h2 className="text-[15px] font-extrabold text-gray-900 dark:text-white">진행 중인 래플</h2>
              </div>
              {ongoing.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 py-6 text-center text-[13px] text-gray-500 dark:border-gray-600">
                  진행 중인 래플이 없습니다.
                </p>
              ) : (
                renderRaffleList(ongoing)
              )}
            </section>

            <section>
              <div className="mb-3">
                <h2 className="text-[15px] font-extrabold text-gray-900 dark:text-white">완료된 래플</h2>
              </div>
              {completed.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 py-6 text-center text-[13px] text-gray-500 dark:border-gray-600">
                  완료된 래플이 없습니다.
                </p>
              ) : (
                renderRaffleList(completed)
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
                {form.editingId ? '래플 수정' : '진행 예정 래플 추가'}
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
                <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">이미지 (PNG 등 파일 또는 URL)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  disabled={imageUploading}
                  onChange={onPickImageFile}
                  className="mb-2 block w-full text-[13px] file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
                <input
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                  placeholder="또는 이미지 URL (https://...)"
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                />
                {imageUploading && <p className="mt-1 text-[11px] text-gray-500">업로드 중...</p>}
              </div>

              {form.kind === 'scheduled' && (
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                    진행 일수 {form.editingId ? '(시작 전에만 변경)' : ''}
                  </label>
                  <select
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                    value={form.duration_days}
                    onChange={(e) => setForm((p) => ({ ...p, duration_days: Number(e.target.value) }))}
                  >
                    {RAFFLE_DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}일
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.kind === 'ongoing' && form.editingId && (
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">진행 일수 (참고)</label>
                  <select
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                    value={form.duration_days}
                    onChange={(e) => setForm((p) => ({ ...p, duration_days: Number(e.target.value) }))}
                  >
                    {RAFFLE_DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}일
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-500">이미 시작된 래플의 종료 시각은 상세 화면에서 조정하세요.</p>
                </div>
              )}

              {form.kind === 'ongoing' || form.kind === 'scheduled' ? (
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">설명</label>
                  <textarea
                    className="min-h-[100px] w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">카테고리</label>
                    <input
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">상태 문구</label>
                    <input
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
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
