import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchNotices, createNotice, updateNotice, deleteNotice } from '../api/noticesSupabase';

const AdminNoticesScreen = () => {
  const navigate = useNavigate();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noticeForm, setNoticeForm] = useState({
    open: false,
    editingId: null,
    title: '',
    category: '공지',
    content: '',
    is_pinned: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ noticeId: null });

  const loadNotices = useCallback(async () => {
    const data = await fetchNotices();
    setNotices(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadNotices().finally(() => setLoading(false));
  }, [loadNotices]);

  const formatDate = (d) => {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openNoticeForm = (notice = null) => {
    if (notice) {
      setNoticeForm({
        open: true,
        editingId: notice.id,
        title: notice.title || '',
        category: notice.category || '공지',
        content: notice.content || '',
        is_pinned: !!notice.is_pinned,
      });
    } else {
      setNoticeForm({
        open: true,
        editingId: null,
        title: '',
        category: '공지',
        content: '',
        is_pinned: false,
      });
    }
  };

  const closeNoticeForm = () => {
    setNoticeForm({ open: false, editingId: null, title: '', category: '공지', content: '', is_pinned: false });
  };

  const handleSaveNotice = async () => {
    const { title, category, content, is_pinned, editingId } = noticeForm;
    if (!title.trim()) {
      alert('제목을 입력하세요.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await updateNotice(editingId, { title: title.trim(), category: category.trim() || '공지', content: content.trim(), is_pinned });
        if (res.success) {
          await loadNotices();
          closeNoticeForm();
        } else {
          alert(res.error || '수정에 실패했습니다.');
        }
      } else {
        const res = await createNotice({ title: title.trim(), category: category.trim() || '공지', content: content.trim(), is_pinned });
        if (res.success) {
          await loadNotices();
          closeNoticeForm();
        } else {
          alert(res.error || '등록에 실패했습니다.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    if (!noticeId) return;
    const { success } = await deleteNotice(noticeId);
    if (success) {
      setNotices((prev) => prev.filter((n) => n.id !== noticeId));
      setDeleteConfirm({ noticeId: null });
    } else {
      alert('공지 삭제에 실패했습니다.');
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
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">공지사항 관리</h1>
        <div className="w-10" />
      </header>

      <main className="p-4 pb-24">
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => openNoticeForm()}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90"
          >
            새 공지
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500">불러오는 중...</div>
        ) : notices.length === 0 ? (
          <div className="py-8 text-center text-gray-500">등록된 공지가 없습니다. 새 공지를 작성해보세요.</div>
        ) : (
          <ul className="space-y-3">
            {notices.map((notice) => (
              <li
                key={notice.id}
                className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{notice.category}</span>
                    {notice.is_pinned && <span className="text-xs text-amber-600">[상단고정]</span>}
                    <h3 className="font-medium text-gray-800 dark:text-white mt-0.5">{notice.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(notice.created_at)}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openNoticeForm(notice)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ noticeId: notice.id })}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                {notice.content && (
                  <p className="text-[13px] text-gray-700 dark:text-gray-200 mt-2 whitespace-pre-wrap">
                    {notice.content}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* 공지 작성/수정 모달 */}
        {noticeForm.open && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-[520px] rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-gray-50 m-0">
                  {noticeForm.editingId ? '공지 수정' : '새 공지'}
                </h3>
                <button type="button" onClick={closeNoticeForm} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-200 mb-1">제목</label>
                  <input
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-[13px]"
                    value={noticeForm.title}
                    onChange={(e) => setNoticeForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-200 mb-1">카테고리</label>
                    <input
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-[13px]"
                      value={noticeForm.category}
                      onChange={(e) => setNoticeForm((p) => ({ ...p, category: e.target.value }))}
                    />
                  </div>
                  <label className="mt-6 inline-flex items-center gap-2 text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={noticeForm.is_pinned}
                      onChange={(e) => setNoticeForm((p) => ({ ...p, is_pinned: e.target.checked }))}
                    />
                    상단 고정
                  </label>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-200 mb-1">내용</label>
                  <textarea
                    className="w-full min-h-[140px] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-[13px] resize-none"
                    value={noticeForm.content}
                    onChange={(e) => setNoticeForm((p) => ({ ...p, content: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={closeNoticeForm}
                  className="flex-1 rounded-full bg-gray-100 dark:bg-gray-800 py-2.5 text-[13px] font-semibold text-gray-700 dark:text-gray-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveNotice}
                  className={`flex-1 rounded-full py-2.5 text-[13px] font-semibold text-white ${submitting ? 'bg-gray-400' : 'bg-primary hover:bg-primary-dark'}`}
                >
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 삭제 확인 */}
        {deleteConfirm.noticeId && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-[320px] rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl">
              <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-gray-50 m-0">공지 삭제</h3>
              <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">
                이 공지를 삭제할까요?
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ noticeId: null })}
                  className="flex-1 rounded-full bg-gray-100 dark:bg-gray-800 py-2.5 text-[13px] font-semibold text-gray-700 dark:text-gray-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNotice(deleteConfirm.noticeId)}
                  className="flex-1 rounded-full bg-rose-600 py-2.5 text-[13px] font-semibold text-white"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminNoticesScreen;

