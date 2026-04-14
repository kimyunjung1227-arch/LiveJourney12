import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { fetchPostsSupabase, deletePostSupabase } from '../api/postsSupabase';
import {
  fetchNotices,
  createNotice,
  updateNotice,
  deleteNotice,
} from '../api/noticesSupabase';
import { getDisplayImageUrl } from '../api/upload';
import { getUploadedPostsSafe } from '../utils/localStorageManager';

const TAB_POSTS = 'posts';
const TAB_NOTICES = 'notices';

const AdminScreen = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState(TAB_POSTS);
  const [posts, setPosts] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noticeForm, setNoticeForm] = useState({ open: false, editingId: null, title: '', category: '공지', content: '', is_pinned: false });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ postId: null, noticeId: null });

  const loadPosts = useCallback(async () => {
    const data = await fetchPostsSupabase();
    setPosts(Array.isArray(data) ? data : []);
  }, []);

  const loadNotices = useCallback(async () => {
    const data = await fetchNotices();
    setNotices(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    if (tab === TAB_POSTS) {
      loadPosts().finally(() => setLoading(false));
    } else {
      loadNotices().finally(() => setLoading(false));
    }
  }, [tab, loadPosts, loadNotices]);

  const handleDeletePost = async (postId) => {
    if (!postId) return;
    const idStr = String(postId).trim();
    const { success, error, hint } = await deletePostSupabase(idStr);
    if (success) {
      setPosts((prev) => prev.filter((p) => p && String(p.id) !== idStr));
      setDeleteConfirm((prev) => ({ ...prev, postId: null }));
      // DB에서 삭제됐으므로 앱에서도 완전 제거: localStorage에서 제거
      try {
        const uploaded = getUploadedPostsSafe();
        const filtered = uploaded.filter((p) => p && String(p.id) !== idStr);
        if (filtered.length !== uploaded.length) {
          localStorage.setItem('uploadedPosts', JSON.stringify(filtered));
        }
      } catch (_) {}
      // 메인 재진입 시에도 제외되도록 sessionStorage에 기록
      try {
        const key = 'adminDeletedPostIds';
        const raw = sessionStorage.getItem(key) || '[]';
        const ids = JSON.parse(raw);
        if (!ids.includes(idStr)) ids.push(idStr);
        sessionStorage.setItem(key, JSON.stringify(ids));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('adminDeletedPost', { detail: { postId: idStr } }));
    } else {
      const msg = hint ? `${error}\n\n${hint}` : error || '게시물 삭제에 실패했습니다.';
      alert(msg);
    }
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
      setDeleteConfirm({ ...deleteConfirm, noticeId: null });
    } else {
      alert('공지 삭제에 실패했습니다.');
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="screen-layout bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">관리자</h1>
        <div className="w-10" />
      </header>

      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setTab(TAB_POSTS)}
          className={`flex-1 py-3 text-sm font-medium ${tab === TAB_POSTS ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400'}`}
        >
          게시물 관리
        </button>
        <button
          type="button"
          onClick={() => setTab(TAB_NOTICES)}
          className={`flex-1 py-3 text-sm font-medium ${tab === TAB_NOTICES ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400'}`}
        >
          공지 관리
        </button>
      </div>

      <main className="p-4 pb-24">
        {tab === TAB_POSTS && (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Supabase에 올라온 게시물만 표시됩니다. 삭제 시 복구할 수 없습니다.</p>
            {loading ? (
              <div className="py-8 text-center text-gray-500">불러오는 중...</div>
            ) : posts.length === 0 ? (
              <div className="py-8 text-center text-gray-500">등록된 게시물이 없습니다.</div>
            ) : (
              <ul className="space-y-3">
                {posts.map((post) => {
                  const thumb = post.images?.[0] || post.thumbnail;
                  return (
                    <li
                      key={post.id}
                      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                        {thumb ? (
                          <img src={getDisplayImageUrl(thumb)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{post.location || post.placeName || post.region || '위치 없음'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(post.createdAt || post.timestamp)} · 좋아요 {post.likes ?? 0}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm({ ...deleteConfirm, postId: post.id })}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm"
                      >
                        삭제
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {tab === TAB_NOTICES && (
          <>
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
                          onClick={() => setDeleteConfirm({ ...deleteConfirm, noticeId: notice.id })}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {/* 공지 작성/수정 모달 */}
      {noticeForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeNoticeForm}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                {noticeForm.editingId ? '공지 수정' : '새 공지'}
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">제목</label>
                <input
                  type="text"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  placeholder="공지 제목"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카테고리</label>
                <input
                  type="text"
                  value={noticeForm.category}
                  onChange={(e) => setNoticeForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                  placeholder="예: 공지, 업데이트, 이벤트"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">내용</label>
                <textarea
                  value={noticeForm.content}
                  onChange={(e) => setNoticeForm((f) => ({ ...f, content: e.target.value }))}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-y"
                  placeholder="마크다운 지원 (예: ## 소제목)"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noticeForm.is_pinned}
                  onChange={(e) => setNoticeForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">상단 고정</span>
              </label>
            </div>
            <div className="p-4 flex gap-2 justify-end border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={closeNoticeForm}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveNotice}
                disabled={submitting}
                className="px-4 py-2 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
              >
                {submitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {(deleteConfirm.postId || deleteConfirm.noticeId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <p className="text-gray-800 dark:text-white font-medium">
              {deleteConfirm.postId ? '이 게시물을 삭제할까요?' : '이 공지를 삭제할까요?'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">삭제 후 복구할 수 없습니다.</p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ postId: null, noticeId: null })}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.postId) handleDeletePost(deleteConfirm.postId);
                  if (deleteConfirm.noticeId) handleDeleteNotice(deleteConfirm.noticeId);
                }}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl font-medium"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
};

export default AdminScreen;
