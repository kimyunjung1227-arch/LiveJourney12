import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPencilPlus } from '@tabler/icons-react';

export default function AskFAB() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/question/new')}
      className="fixed flex items-center gap-1.5"
      style={{
        bottom: 20,
        right: 18,
        background: '#4DB8E8',
        color: 'white',
        padding: '14px 20px',
        borderRadius: 28,
        fontSize: 14,
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 6px 18px rgba(77, 184, 232, 0.45)',
        zIndex: 40,
      }}
    >
      <IconPencilPlus size={18} />
      질문하기
    </button>
  );
}
