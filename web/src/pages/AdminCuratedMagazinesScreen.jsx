import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchAdminMagazines,
  deleteMagazine,
} from '../api/curatedMagazinesSupabase';

const formatDate = (d) => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AdminCuratedMagazinesScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState({ id: null });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchAdminMagazines();
    setItems(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onDelete = async () => {
    const id = deleteConfirm.id;
    if (!id) return;
    setBusy(true);
    try {
      const res = await deleteMagazine(id);
      if (res.success) {
        await load();
        setDeleteConfirm({ id: null });
      } else {
        // eslint-disable-next-line no-alert
        window.alert(`삭제 실패: ${res.error}`);
      }
    } finally {
      setBusy(false);
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
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">큐레이션 매거진</h1>
        <button
          type="button"
          onClick={() => navigate('/admin/curated-magazines/new')}
          className="px-3 h-9 rounded-lg bg-primary text-white text-[13px] font-bold hover:opacity-90"
        >
          + 새 발행
        </button>
      </header>

      <main className="p-4 pb-24">
        {loading ? (
          <p className="text-center text-gray-500 text-sm py-8">불러오는 중...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-gray-300 bg-white dark:bg-gray-800">
            <p className="text-sm text-gray-500">아직 발행한 매거진이 없습니다.</p>
            <p className="text-xs text-gray-400 mt-1">우측 상단 "+ 새 발행"으로 시작하세요.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {items.map((it) => (
              <li
                key={it.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm"
              >
                <div
                  className="h-28 relative bg-gray-200 dark:bg-gray-700"
                  style={{
                    backgroundImage: it.cover_image_url ? `url(${it.cover_image_url})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent flex items-end p-3">
                    <div className="text-white min-w-0">
                      <p className="text-[10px] opacity-80">
                        {it.region || '전체'} · {it.status === 'published' ? '발행' : '임시저장'}
                      </p>
                      <p className="text-[14px] font-bold truncate">{it.title}</p>
                      {it.subtitle && (
                        <p className="text-[11px] opacity-90 truncate">{it.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded"
                    style={{
                      background: it.status === 'published' ? '#22c55e' : '#94a3b8',
                      color: '#fff',
                    }}
                  >
                    {it.status === 'published' ? 'PUBLISHED' : 'DRAFT'}
                  </span>
                </div>
                <div className="p-3 text-[11px] text-gray-500">
                  {it.status === 'published'
                    ? `발행: ${formatDate(it.published_at)}`
                    : `최근 수정: ${formatDate(it.updated_at)}`}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/curated-magazines/${it.id}`)}
                      className="flex-1 h-9 rounded-lg border border-gray-300 dark:border-gray-600 text-[12px] font-bold text-gray-800 dark:text-gray-100"
                    >
                      편집
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
                onClick={onDelete}
                disabled={busy}
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
}
