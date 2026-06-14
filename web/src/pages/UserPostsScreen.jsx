import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconTrash, IconPencil } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import UserPostsList, { useUserPosts } from '../components/profile/UserPostsList';
import { deletePostSupabase } from '../api/postsSupabase';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

const TEXT_PRIMARY = '#1F1F1F';
const TEXT_SECONDARY = '#6B6B6B';
const BORDER_LIGHT = '#E8E8E8';
const KEY = '#4DB8E8';
const DANGER = '#E5484D';

/**
 * 한 사용자가 올린 게시물 전체 목록 화면.
 * - /profile/posts        : 내 게시물 (로그인 사용자) — 선택 삭제(수정) 가능
 * - /user/:userId/posts   : 특정 사용자의 게시물 (보기 전용)
 */
export default function UserPostsScreen() {
  const navigate = useNavigate();
  const { userId: paramUserId } = useParams();
  const { user } = useAuth();
  const userId = paramUserId || user?.id || null;
  const isMe = !!userId && (!paramUserId || String(userId) === String(user?.id));

  const { data } = useProfile(userId);
  const { posts: fetched, loading } = useUserPosts(userId, null);

  // 삭제 후 목록을 바로 반영하기 위해 로컬 미러로 관리
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    setPosts(Array.isArray(fetched) ? fetched : []);
  }, [fetched]);

  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const selectedCount = selected.size;

  const name = data?.user?.name || '';
  const title = name ? `${name}의 게시물` : '게시물';

  const exitEdit = () => {
    setEditMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  };

  const handleDelete = async () => {
    if (selectedCount === 0 || deleting) return;
    const ok = window.confirm(`선택한 ${selectedCount}개의 게시물을 삭제할까요? 되돌릴 수 없어요.`);
    if (!ok) return;

    setDeleting(true);
    const ids = Array.from(selected);
    const results = await Promise.all(ids.map((id) => deletePostSupabase(id)));
    const deletedIds = new Set(ids.filter((id, i) => results[i]?.success));
    const failedCount = ids.length - deletedIds.size;

    if (deletedIds.size > 0) {
      setPosts((prev) => prev.filter((p) => !deletedIds.has(p.id)));
    }
    setSelected(new Set());
    setDeleting(false);
    if (failedCount > 0) {
      window.alert(
        `${deletedIds.size}개를 삭제했어요.\n${failedCount}개는 삭제하지 못했어요(권한 또는 네트워크 문제).`
      );
    }
    // 남은 게시물이 없으면 선택 모드 종료
    if (deletedIds.size > 0 && posts.length - deletedIds.size === 0) exitEdit();
  };

  const iconBtn = {
    width: 36,
    height: 36,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={{ background: '#fff', minHeight: '100vh', paddingBottom: 32 }}>
      <PageSeo {...(PAGE_SEO.userProfile || PAGE_SEO.profile)} />

      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 52,
          padding: '0 8px',
          borderBottom: `1px solid ${BORDER_LIGHT}`,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 좌측: 뒤로가기 / (편집 모드) 취소 */}
        <button
          type="button"
          onClick={() => (editMode ? exitEdit() : navigate(-1))}
          aria-label={editMode ? '선택 취소' : '뒤로가기'}
          style={{
            ...iconBtn,
            position: 'absolute',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            minWidth: 36,
            fontSize: 15,
            color: TEXT_PRIMARY,
          }}
        >
          {editMode ? '취소' : <IconArrowLeft size={18} color={TEXT_PRIMARY} />}
        </button>

        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            maxWidth: 'calc(100% - 150px)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {editMode ? `${selectedCount}개 선택` : title}
        </span>

        {/* 우측: (보기) 수정 아이콘 / (편집) 전체선택 + 삭제 — 모두 헤더 안 */}
        {isMe && posts.length > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {editMode ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={selectedCount === 0 || deleting}
                aria-label="선택 삭제"
                style={{
                  ...iconBtn,
                  cursor: selectedCount === 0 || deleting ? 'default' : 'pointer',
                }}
              >
                <IconTrash
                  size={20}
                  stroke={2}
                  color={selectedCount === 0 ? '#C4C4C4' : DANGER}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                aria-label="게시물 편집"
                style={iconBtn}
              >
                <IconPencil size={18} color={TEXT_PRIMARY} stroke={2} />
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '4px 18px 0' }}>
        {loading ? (
          <div
            className="text-center"
            style={{ padding: 40, color: TEXT_SECONDARY, fontSize: 13 }}
          >
            불러오는 중...
          </div>
        ) : (
          <>
            {posts.length > 0 &&
              (editMode ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0 4px',
                  }}
                >
                  <span style={{ fontSize: 12.5, color: TEXT_SECONDARY }}>
                    삭제할 게시물을 선택하세요
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      fontSize: 13,
                      fontWeight: 600,
                      color: KEY,
                    }}
                  >
                    {allSelected ? '모두해제' : '모두선택'}
                  </button>
                </div>
              ) : (
                <p
                  className="m-0"
                  style={{ fontSize: 12.5, color: TEXT_SECONDARY, padding: '12px 0 4px' }}
                >
                  총 {posts.length}개
                </p>
              ))}
            <UserPostsList
              posts={posts}
              selectable={editMode}
              selectedIds={selected}
              onToggleSelect={toggleSelect}
            />
          </>
        )}
      </div>
    </div>
  );
}
