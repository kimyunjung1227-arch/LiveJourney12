import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const STORAGE_KEY = 'mapSituationQuestions_v1';

export default function MapAskSituationScreen() {
  const navigate = useNavigate();
  const [text, setText] = useState('');

  const submit = () => {
    const q = text.trim();
    if (!q) return;
    try {
      const prev = JSON.parse(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) || '[]' : '[]');
      const next = Array.isArray(prev) ? prev : [];
      next.unshift({
        id: String(Date.now()),
        body: q,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 50)));
    } catch {
      /* ignore */
    }
    navigate(-1);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 pt-12">
        <button type="button" onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-50" aria-label="뒤로">
          <ArrowLeft className="h-5 w-5 text-gray-800" />
        </button>
        <h1 className="text-base font-bold text-gray-900">현장 상황 물어보기</h1>
      </header>
      <div className="flex flex-1 flex-col px-4 py-4">
        <p className="mb-3 text-sm leading-relaxed text-gray-600">
          지금 이곳의 날씨·혼잡도·분위기 등 궁금한 점을 다른 여행자에게 물어보세요. 등록된 내용은 앱 내 기록으로 저장됩니다.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 지금 벚꽃 많이 폈나요? 줄이 길까요?"
          className="min-h-[168px] w-full resize-none rounded-2xl border border-gray-200 p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-40"
        >
          질문 등록하기
        </button>
      </div>
    </div>
  );
}
