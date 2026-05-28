import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchSeasonalHighlights,
  createSeasonalHighlight,
  updateSeasonalHighlight,
  deleteSeasonalHighlight,
} from '../api/seasonalHighlightsSupabase';

const CATEGORY_OPTIONS = [
  { id: '', label: '선택 안 함' },
  { id: 'nature', label: '개화·자연' },
  { id: 'weather', label: '날씨·체감' },
  { id: 'event', label: '이벤트·축제' },
  { id: 'crowd', label: '혼잡도·대기' },
  { id: 'sunset', label: '노을·야경' },
  { id: 'business', label: '영업·운영' },
];

const blankForm = {
  open: false,
  editingId: null,
  title: '',
  period_label: '',
  category: '',
  related_place_names: '',
  cover_color_start: '#87CEEB',
  cover_color_end: '#1A6EA8',
  starts_at: '',
  ends_at: '',
  display_order: 0,
  is_active: true,
  curation_body: '',
  peak_label: '',
  peak_ends_at: '',
};

function formatDate(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const AdminMagazinesScreen = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blankForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ id: null });

  const load = useCallback(async () => {
    const data = await fetchSeasonalHighlights();
    setItems(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const openNew = () => setForm({ ...blankForm, open: true });

  const openEdit = (it) => {
    setForm({
      open: true,
      editingId: it.id,
      title: it.title || '',
      period_label: it.period_label || '',
      category: it.category || '',
      related_place_names: Array.isArray(it.related_place_names)
        ? it.related_place_names.join(', ')
        : '',
      cover_color_start: it.cover_color_start || '#87CEEB',
      cover_color_end: it.cover_color_end || '#1A6EA8',
      starts_at: it.starts_at || '',
      ends_at: it.ends_at || '',
      display_order: Number.isFinite(Number(it.display_order)) ? Number(it.display_order) : 0,
      is_active: !!it.is_active,
      curation_body: it.curation_body || '',
      peak_label: it.peak_label || '',
      peak_ends_at: it.peak_ends_at || '',
    });
  };

  const close = () => setForm(blankForm);

  const handleSave = async () => {
    const title = form.title.trim();
    const period_label = form.period_label.trim();
    if (!title) {
      // eslint-disable-next-line no-alert
      window.alert('제목을 입력하세요.');
      return;
    }
    if (!period_label) {
      // eslint-disable-next-line no-alert
      window.alert('기간 라벨을 입력하세요. (예: 5월 마지막주)');
      return;
    }
    const payload = {
      title,
      period_label,
      category: form.category || null,
      related_place_names: form.related_place_names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      cover_color_start: form.cover_color_start,
      cover_color_end: form.cover_color_end,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      display_order: Number(form.display_order) || 0,
      is_active: !!form.is_active,
      curation_body: form.curation_body,
      peak_label: form.peak_label || null,
      peak_ends_at: form.peak_ends_at || null,
    };

    setSubmitting(true);
    try {
      const res = form.editingId
        ? await updateSeasonalHighlight(form.editingId, payload)
        : await createSeasonalHighlight(payload);
      if (res.success) {
        await load();
        close();
      } else {
        // eslint-disable-next-line no-alert
        window.alert(`저장 실패: ${res.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const id = deleteConfirm.id;
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await deleteSeasonalHighlight(id);
      if (res.success) {
        await load();
        setDeleteConfirm({ id: null });
      } else {
        // eslint-disable-next-line no-alert
        window.alert(`삭제 실패: ${res.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen-layout bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="뒤로가기"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">매거진 관리</h1>
        <button
          type="button"
          onClick={openNew}
          className="px-3 h-9 rounded-lg bg-primary text-white text-[13px] font-bold hover:opacity-90"
        >
          + 신규
        </button>
      </header>

      <main className="p-4 pb-24">
        {loading ? (
          <p className="text-center text-gray-500 text-sm py-8">불러오는 중...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-gray-300 bg-white dark:bg-gray-800">
            <p className="text-sm text-gray-500">등록된 매거진이 없습니다.</p>
            <p className="text-xs text-gray-400 mt-1">우측 상단 "+ 신규" 버튼으로 추가하세요.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {items.map((it) => (
              <li
                key={it.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm"
              >
                <div
                  className="h-20 px-4 flex items-center justify-between"
                  style={{
                    background: `linear-gradient(135deg, ${it.cover_color_start || '#87CEEB'}, ${it.cover_color_end || '#1A6EA8'})`,
                    color: '#fff',
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] opacity-90">{it.period_label}</p>
                    <p className="text-[15px] font-bold truncate">{it.title}</p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-1 rounded"
                    style={{ background: it.is_active ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.3)' }}
                  >
                    {it.is_active ? '활성' : '비활성'}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-[12px] text-gray-600 dark:text-gray-300">
                    {it.category || '카테고리 없음'} · 순서 {it.display_order ?? 0}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {formatDate(it.starts_at)} ~ {formatDate(it.ends_at)}
                  </p>
                  {it.curation_body && (
                    <p className="text-[12px] text-gray-700 dark:text-gray-200 mt-2 line-clamp-2">
                      {it.curation_body}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => openEdit(it)}
                      className="flex-1 h-9 rounded-lg border border-gray-300 dark:border-gray-600 text-[12px] font-bold text-gray-800 dark:text-gray-100"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ id: it.id })}
                      className="flex-1 h-9 rounded-lg border border-red-300 text-[12px] font-bold text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {form.open && (
        <FormModal
          form={form}
          setForm={setForm}
          onClose={close}
          onSave={handleSave}
          submitting={submitting}
        />
      )}

      {deleteConfirm.id && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-6"
          onClick={() => setDeleteConfirm({ id: null })}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-gray-900 dark:text-white">매거진을 삭제할까요?</p>
            <p className="text-xs text-gray-500 mt-1">이 작업은 되돌릴 수 없어요.</p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ id: null })}
                className="flex-1 h-10 rounded-lg border border-gray-300 text-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 h-10 rounded-lg bg-red-500 text-white text-sm font-bold disabled:opacity-60"
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function FormModal({ form, setForm, onClose, onSave, submitting }) {
  const update = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {form.editingId ? '매거진 수정' : '매거진 등록'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-100"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <Field label="제목 *">
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="서울 장미축제 현장"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </Field>

          <Field label="기간 라벨 * (예: 5월 마지막주, 6월 초~중순)">
            <input
              type="text"
              value={form.period_label}
              onChange={(e) => update('period_label', e.target.value)}
              placeholder="5월 마지막주"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </Field>

          <Field label="카테고리">
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="관련 장소 (쉼표 구분)">
            <input
              type="text"
              value={form.related_place_names}
              onChange={(e) => update('related_place_names', e.target.value)}
              placeholder="중랑천 장미공원, 서울숲, 올림픽공원"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="배경 시작 색">
              <input
                type="color"
                value={form.cover_color_start}
                onChange={(e) => update('cover_color_start', e.target.value)}
                className="w-full h-10 px-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              />
            </Field>
            <Field label="배경 끝 색">
              <input
                type="color"
                value={form.cover_color_end}
                onChange={(e) => update('cover_color_end', e.target.value)}
                className="w-full h-10 px-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              />
            </Field>
          </div>

          <div
            className="h-20 rounded-lg flex items-end p-3"
            style={{
              background: `linear-gradient(135deg, ${form.cover_color_start}, ${form.cover_color_end})`,
              color: '#fff',
            }}
          >
            <div>
              <p className="text-[10px] opacity-90">{form.period_label || '기간 라벨'}</p>
              <p className="text-[14px] font-bold">{form.title || '제목 미리보기'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일">
              <input
                type="date"
                value={form.starts_at}
                onChange={(e) => update('starts_at', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
            </Field>
            <Field label="종료일">
              <input
                type="date"
                value={form.ends_at}
                onChange={(e) => update('ends_at', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="피크 라벨 (예: 만개, 하지 임박)">
              <input
                type="text"
                value={form.peak_label}
                onChange={(e) => update('peak_label', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
            </Field>
            <Field label="피크 종료일">
              <input
                type="date"
                value={form.peak_ends_at}
                onChange={(e) => update('peak_ends_at', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
            </Field>
          </div>

          <Field label="큐레이션 본문">
            <textarea
              value={form.curation_body}
              onChange={(e) => update('curation_body', e.target.value)}
              rows={4}
              placeholder="이 시즌의 포인트, 추천 시간대 등"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="노출 순서 (작을수록 앞)">
              <input
                type="number"
                value={form.display_order}
                onChange={(e) => update('display_order', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
            </Field>
            <Field label="상태">
              <label className="inline-flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => update('is_active', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">활성</span>
              </label>
            </Field>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-bold"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={submitting}
            className="flex-1 h-11 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-60"
          >
            {submitting ? '저장 중...' : form.editingId ? '수정 저장' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminMagazinesScreen;
