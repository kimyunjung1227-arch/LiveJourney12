import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead, deleteNotification } from '../utils/notifications';

// 간단한 알림 아이콘 컴포넌트
const NotificationIcon = ({ type }) => {
  const icons = {
    badge: 'military_tech',
    like: 'favorite',
    comment: 'comment',
    follow: 'person_add',
    post: 'photo_camera'
  };
  return <span className="material-symbols-outlined">{icons[type] || 'notifications'}</span>;
};

const NotificationsScreen = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all'); // 'all', 'interest'
  const [showMarkAllReadModal, setShowMarkAllReadModal] = useState(false);
  const [allNotifications, setAllNotifications] = useState([]);

  // 알림 불러오기
  useEffect(() => {
    loadNotifications();

    // 알림 변경 이벤트 리스너
    const handleNotificationUpdate = () => {
      loadNotifications();
    };

    window.addEventListener('notificationUpdate', handleNotificationUpdate);

    return () => {
      window.removeEventListener('notificationUpdate', handleNotificationUpdate);
    };
  }, []);

  const loadNotifications = () => {
    const notifications = getNotifications();
    setAllNotifications(notifications);
  };

  // 필터링된 알림
  const filteredNotifications = filter === 'interest'
    ? allNotifications.filter(n => n.type === 'interest')
    : allNotifications;

  const handleNotificationClick = (notification) => {
    // 알림 읽음 처리
    if (!notification.read) {
      markNotificationAsRead(notification.id);
      loadNotifications();
    }

    // SOS 요청 알림인 경우 해당 위치로 이동
    if (notification.data && notification.data.type === 'sos_request' && notification.data.sosRequest) {
      const sosRequest = notification.data.sosRequest;
      navigate('/map', {
        state: {
          sosLocation: sosRequest.coordinates,
          sosRequest: sosRequest
        }
      });
      return;
    }

    // 일반 알림은 link로 이동
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    loadNotifications();
    setShowMarkAllReadModal(false);

    // 알림 카운트 업데이트 이벤트 발생
    window.dispatchEvent(new Event('notificationCountChanged'));
  };

  const handleDelete = (notificationId, e) => {
    e.stopPropagation();
    deleteNotification(notificationId);
    loadNotifications();

    // 알림 카운트 업데이트 이벤트 발생
    window.dispatchEvent(new Event('notificationCountChanged'));
  };

  const cancelMarkAllRead = () => {
    setShowMarkAllReadModal(false);
  };

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark relative h-screen overflow-hidden">
      <div className="screen-content">
        {/* 헤더 */}
        <header className="screen-header flex h-16 items-center justify-between border-b border-border-light bg-white dark:border-border-dark dark:bg-gray-900 px-4 shadow-sm">
          <button
            onClick={() => navigate('/main')}
            className="flex size-12 shrink-0 items-center justify-center cursor-pointer text-content-light dark:text-content-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <h1 className="flex-1 text-center text-lg font-bold leading-tight tracking-[-0.015em] text-content-light dark:text-content-dark">
            알림
          </h1>
          <button
            onClick={() => setShowMarkAllReadModal(true)}
            disabled={allNotifications.filter(n => !n.read).length === 0}
            className="flex size-12 shrink-0 items-center justify-end cursor-pointer text-content-light dark:text-content-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>check</span>
          </button>
        </header>

        {/* 필터 탭 */}
        <div className="screen-body">
          <div className="flex gap-2 border-b border-border-light dark:border-border-dark px-4 py-3 bg-surface-light/60 dark:bg-surface-dark/80 backdrop-blur">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-colors ${filter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-background-light dark:bg-background-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-primary/10'
                }`}
            >
              전체 ({allNotifications.length})
            </button>
            <button
              onClick={() => setFilter('interest')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-semibold transition-colors ${filter === 'interest'
                  ? 'bg-primary text-white'
                  : 'bg-background-light dark:bg-background-dark text-text-secondary-light dark:text-text-secondary-dark hover:bg-primary/10'
                }`}
            >
              관심지역 소식 ({allNotifications.filter(n => n.type === 'interest').length})
            </button>
          </div>

          {/* 알림 목록 */}
          <div className="pb-20">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <span className="material-symbols-outlined text-7xl text-gray-300 dark:text-gray-600 mb-4">
                  notifications_off
                </span>
                <p className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
                  알림이 없습니다
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mb-4">
                  {filter === 'unread'
                    ? '읽은 알림이 없습니다.'
                    : '여행 정보를 공유하고 다른 사용자와 소통하면 알림을 받을 수 있어요!'}
                </p>
                <button
                  onClick={() => navigate('/upload')}
                  className="bg-primary text-white px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors shadow-lg flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">add_a_photo</span>
                  첫 사진 올리기
                </button>
                <button
                  onClick={() => navigate('/main')}
                  className="mt-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-2.5 rounded-full font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  둘러보기
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border-light dark:divide-border-dark">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex gap-4 px-4 py-4 cursor-pointer hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors ${!notification.read ? 'bg-primary/5 dark:bg-primary/10' : 'bg-white dark:bg-gray-900'
                      }`}
                  >
                    <div className={`flex size-12 shrink-0 items-center justify-center rounded-full ${notification.iconBg || 'bg-primary/10'
                      }`}>
                      <NotificationIcon type={notification.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-content-light dark:text-content-dark">
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="flex size-2 shrink-0 rounded-full bg-primary mt-1.5"></span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[11px] text-subtle-light dark:text-subtle-dark mt-2">
                        {notification.time}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(notification.id, e)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNavigation />

      {/* 모두 읽음 확인 모달 */}
      {showMarkAllReadModal && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                모든 알림을 읽음 처리하시겠습니까?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                안 읽은 알림 {allNotifications.filter(n => !n.read).length}개가 모두 읽음 처리됩니다.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={cancelMarkAllRead}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleMarkAllRead}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsScreen;
