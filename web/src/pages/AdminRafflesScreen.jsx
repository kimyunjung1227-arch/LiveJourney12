import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRaffles, createRaffle, updateRaffle, deleteRaffle } from '../api/rafflesSupabase';

const BADGE_OPTIONS = ['당첨', '미당첨', '미응모'];

const emptyForm = {
  open: false,
  kind: 'ongoing',
  editingId: null,
  title: '',
  description: '',
  image_url: '',
  days_left: '',
  category: '',
  status_message: '',
  badge: '미응모',
  sort_order: 0,
};

const AdminRafflesScreen = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ id: null });

  const load = useCallback(async () => {
    const data = await fetchRaffles();
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const ongoing = useMemo(() => rows.filter((r) => r.kind === 'ongoing'), [rows]);
  const completed = useMemo(() => rows.filter((r) => r.kind === 'completed'), [rows]);

  const openCreate = (kind) => {
    setForm({
      ...emptyForm,
      open: true,
      kind,
      days_left: '7일 남음',
      sort_order: 0,
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
    });
  };

  const closeForm = () => setForm(emptyForm);

  const handleSave = async () => {
    const { editingId, kind, title, image_url, description, days_left, category, status_message, badge, sort_order } = form;
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
          title,
          image_url,
          description,
          sort_order,
          ...(kind === 'ongoing'
            ? {
                days_left,
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
          kind,
          title,
          image_url,
          description,
          days_left,
          category,
          status_message,
          badge,
          sort_order,
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

  const handleDelete = async (id) => {
    if (!id) return;
    const { success } = await deleteRaffle(id);
    if (success) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirm({ id: null });
    } else {
      alert('삭제에 실패했습니다. (Supabase에 raffles 테이블이 적용되어 있고 admin_users에 본인이 등록되어 있는지 확인하세요.)');
    }
  };

  const renderList = (list) => (
    <ul className="space-y-2">
      {list.map((r) => (
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
              {r.kind === 'ongoing' && r.days_left ? ` · ${r.days_left}` : ''}
              {r.kind === 'completed' && r.badge ? ` · ${r.badge}` : ''}
            </div>
            <div className="mt-2 flex gap-2">
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
      ))}
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
          진행 중·완료 래플을 등록하면 앱 래플 화면에 반영됩니다. DB에 데이터가 없으면 앱에는 안내 문구만
          표시됩니다. 스키마:{' '}
          <code className="rounded bg-gray-200 px-1 text-[12px] dark:bg-gray-700">supabase/migrations/20250412000000_raffles.sql</code>
        </p>

        {loading ? (
          <div className="py-8 text-center text-gray-500">불러오는 중...</div>
        ) : (
          <>
            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-extrabold text-gray-900 dark:text-white">진행 중인 래플</h2>
                <button
                  type="button"
                  onClick={() => openCreate('ongoing')}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  추가
                </button>
              </div>
              {ongoing.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 py-6 text-center text-[13px] text-gray-500 dark:border-gray-600">
                  등록된 진행 래플이 없습니다.
                </p>
              ) : (
                renderList(ongoing)
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-extrabold text-gray-900 dark:text-white">완료된 래플</h2>
                <button
                  type="button"
                  onClick={() => openCreate('completed')}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  추가
                </button>
              </div>
              {completed.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 py-6 text-center text-[13px] text-gray-500 dark:border-gray-600">
                  등록된 완료 래플이 없습니다.
                </p>
              ) : (
                renderList(completed)
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
                {form.editingId ? '래플 수정' : form.kind === 'ongoing' ? '진행 래플 추가' : '완료 래플 추가'}
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

              {form.kind === 'ongoing' ? (
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
                    <label className="mb-1 block text-[12px] font-semibold text-gray-700 dark:text-gray-200">남은 기간 표시</label>
                    <input
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-[13px] dark:border-gray-700 dark:bg-gray-950"
                      placeholder="예: 5일 남음"
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
