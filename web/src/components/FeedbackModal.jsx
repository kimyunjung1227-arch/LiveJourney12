import React, { useState } from 'react';
import { logger } from '../utils/logger';
import { getBackendOrigin } from '../utils/apiBase';

const FeedbackModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    type: 'feature',
    category: 'functionality',
    title: '',
    description: '',
    screen: '',
    feature: '',
    username: '',
    email: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 필수 필드 검증
    if (!formData.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    if (!formData.description.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }

    if (formData.description.trim().length < 10) {
      setError('내용을 10자 이상 입력해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      // 브라우저 정보 수집
      const userAgent = navigator.userAgent;
      const deviceInfo = /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'mobile' : 'desktop';
      const browserInfo = userAgent.includes('Chrome') ? 'Chrome' :
                         userAgent.includes('Firefox') ? 'Firefox' :
                         userAgent.includes('Safari') ? 'Safari' :
                         userAgent.includes('Edge') ? 'Edge' : 'Other';

      const response = await fetch(`${getBackendOrigin()}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          userAgent,
          deviceInfo,
          browserInfo
        })
      });

      const data = await response.json();

      if (data.success) {
        // 성공 시 폼 초기화
        setFormData({
          type: 'feature',
          category: 'functionality',
          title: '',
          description: '',
          screen: '',
          feature: '',
          username: '',
          email: ''
        });
        
        if (onSubmit) {
          onSubmit(data);
        } else {
          alert('피드백이 성공적으로 제출되었습니다. 감사합니다!');
          onClose();
        }
      } else {
        setError(data.message || '피드백 제출에 실패했습니다.');
      }
    } catch (err) {
      logger.error('피드백 제출 오류:', err);
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 1
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            피드백 보내기
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              border: 'none',
              background: '#f5f5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#eeeeee'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f5f5f5'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#666' }}>
              close
            </span>
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div style={{
              padding: '12px',
              background: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              marginBottom: '16px',
              color: '#c33',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* 피드백 유형 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#333'
            }}>
              피드백 유형 *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="bug">버그 신고</option>
              <option value="feature">기능 제안</option>
              <option value="improvement">개선 사항</option>
              <option value="question">질문</option>
              <option value="other">기타</option>
            </select>
          </div>

          {/* 카테고리 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#333'
            }}>
              카테고리
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="ui">UI/디자인</option>
              <option value="functionality">기능</option>
              <option value="performance">성능</option>
              <option value="content">콘텐츠</option>
              <option value="other">기타</option>
            </select>
          </div>

          {/* 제목 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#333'
            }}>
              제목 *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              maxLength={200}
              placeholder="피드백 제목을 입력해주세요"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 내용 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#333'
            }}>
              내용 * (최소 10자)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              minLength={10}
              maxLength={2000}
              rows={6}
              placeholder="피드백 내용을 자세히 입력해주세요"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            <div style={{
              marginTop: '4px',
              fontSize: '12px',
              color: '#999',
              textAlign: 'right'
            }}>
              {formData.description.length} / 2000
            </div>
          </div>

          {/* 관련 화면 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#333'
            }}>
              관련 화면 (선택)
            </label>
            <input
              type="text"
              name="screen"
              value={formData.screen}
              onChange={handleChange}
              placeholder="예: 지도 화면, 메인 화면"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 관련 기능 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#333'
            }}>
              관련 기능 (선택)
            </label>
            <input
              type="text"
              name="feature"
              value={formData.feature}
              onChange={handleChange}
              placeholder="예: 경로 만들기, 사진 업로드"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 이름 (선택) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#333'
            }}>
              이름 (선택, 익명 가능)
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="이름을 입력하시면 답변을 받을 수 있습니다"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 이메일 (선택) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#333'
            }}>
              이메일 (선택)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="이메일을 입력하시면 답변을 받을 수 있습니다"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 버튼 */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                background: 'white',
                color: '#333',
                fontSize: '14px',
                fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.5 : 1
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: submitting ? '#ccc' : '#00BCD4',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {submitting ? '제출 중...' : '제출하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;
