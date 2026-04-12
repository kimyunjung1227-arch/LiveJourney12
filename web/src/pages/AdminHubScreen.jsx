import React from 'react';
import { useNavigate } from 'react-router-dom';

const tiles = [
  {
    id: 'notices',
    title: '공지사항 관리',
    desc: '공지 등록/수정/삭제 및 상단 고정',
    icon: 'campaign',
    path: '/admin/notices',
  },
  {
    id: 'posts',
    title: '게시물 관리',
    desc: '게시물 목록 확인 및 삭제',
    icon: 'dataset',
    path: '/admin/posts',
  },
  {
    id: 'magazine-publish',
    title: '매거진 발행',
    desc: '발행 매거진 생성/수정',
    icon: 'auto_stories',
    path: '/admin/magazine/publish',
  },
  {
    id: 'magazine-manage',
    title: '발행 매거진 관리',
    desc: '발행된 매거진 확인 및 삭제',
    icon: 'library_books',
    path: '/admin/magazine/manage',
  },
  {
    id: 'raffles',
    title: '래플 관리',
    desc: '진행 중·완료 래플 등록 및 수정',
    icon: 'redeem',
    path: '/admin/raffles',
  },
];

const AdminHubScreen = () => {
  const navigate = useNavigate();

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
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">어드민</h1>
        <div className="w-10" />
      </header>

      <main className="p-4 pb-24">
        <div className="grid grid-cols-1 gap-3">
          {tiles.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(t.path)}
              className="w-full flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <span className="material-symbols-outlined text-[26px]">{t.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold text-gray-900 dark:text-white">{t.title}</div>
                <div className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2">{t.desc}</div>
              </div>
              <span className="material-symbols-outlined text-[20px] text-gray-400">chevron_right</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminHubScreen;

