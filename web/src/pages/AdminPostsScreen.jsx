import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPostsSupabase, deletePostSupabase } from '../api/postsSupabase';
import { getDisplayImageUrl } from '../api/upload';
import { getUploadedPostsSafe } from '../utils/localStorageManager';

const AdminPostsScreen = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState({ postId: null });

  const loadPosts = useCallback(async () => {
    const data = await fetchPostsSupabase();
    setPosts(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPosts().finally(() => setLoading(false));
  }, [loadPosts]);

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

  const handleDeletePost = async (postId) => {
    if (!postId) return;
    const idStr = String(postId).trim();
    const { success, error, hint } = await deletePostSupabase(idStr);
    if (success) {
      setPosts((prev) => prev.filter((p) => p && String(p.id) !== idStr));
      setDeleteConfirm({ postId: null });
      try {
        const uploaded = getUploadedPostsSafe();
        const filtered = uploaded.filter((p) => p && String(p.id) !== idStr);
        if (filtered.length !== uploaded.length) {
          localStorage.setItem('uploadedPosts', JSON.stringify(filtered));
        }
      } catch (_) {}
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
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">게시물 관리</h1>
        <div className="w-10" />
      </header>

      <main className="p-4 pb-24">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Supabase에 올라온 게시물만 표시됩니다. 삭제 시 복구할 수 없습니다.
        </p>
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
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {post.location || post.placeName || post.region || '위치 없음'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(post.createdAt || post.timestamp)} · 좋아요 {post.likes ?? 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ postId: post.id })}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm"
                  >
                    삭제
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {deleteConfirm.postId && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-[320px] rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl">
              <h3 className="text-[16px] font-extrabold text-gray-900 dark:text-gray-50 m-0">게시물 삭제</h3>
              <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">
                이 게시물을 삭제할까요? 삭제하면 복구할 수 없습니다.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ postId: null })}
                  className="flex-1 rounded-full bg-gray-100 dark:bg-gray-800 py-2.5 text-[13px] font-semibold text-gray-700 dark:text-gray-100"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePost(deleteConfirm.postId)}
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

export default AdminPostsScreen;

