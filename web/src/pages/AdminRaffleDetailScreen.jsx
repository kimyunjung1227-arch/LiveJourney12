import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchRaffleById,
  startScheduledRaffle,
  endRaffleWithMode,
  deleteRaffle,
  RAFFLE_START_MIDNIGHT,
  RAFFLE_START_IMMEDIATE,
  RAFFLE_END_NOW,
  RAFFLE_END_MIDNIGHT,
} from '../api/rafflesSupabase';
import { formatDaysLeftKorean } from '../utils/raffleSchedule';

const kindLabel = (k) => {
  if (k === 'scheduled') return '진행 예정';
  if (k === 'ongoing') return '진행 중';
  if (k === 'completed') return '완료';
  return k || '';
};

const AdminRaffleDetailScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    const { raffle, error } = await fetchRaffleById(id);
    setRow(raffle);
    setErr(error || (raffle ? null : '래플을 찾을 수 없습니다.'));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res && res.success === false) {
        alert(res.error || '처리에 실패했습니다.');
        return;
      }
      const refreshed = await fetchRaffleById(id);
      if (refreshed.raffle) {
        setRow(refreshed.raffle);
        setErr(null);
      } else {
        navigate('/admin/raffles');
      }
    } finally {
      setBusy(false);
      setStartOpen(false);
      setEndOpen(false);
    }
  };

  const onStartImmediate = () => run(() => startScheduledRaffle(id, RAFFLE_START_IMMEDIATE));
  const onStartMidnight = () => run(() => startScheduledRaffle(id, RAFFLE_START_MIDNIGHT));
  const onEndNow = () => run(() => endRaffleWithMode(id, RAFFLE_END_NOW));
  const onEndMidnight = () => run(() => endRaffleWithMode(id, RAFFLE_END_MIDNIGHT));

  const onDelete = async () => {
    if (!window.confirm('이 래플을 삭제할까요?')) return;
    setBusy(true);
    try {
      const { success } = await deleteRaffle(id);
      if (success) navigate('/admin/raffles');
      else alert('삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const goEdit = () => {
    navigate('/admin/raffles', { state: { openEditId: id } });
  };

  return (
    <div className="screen-layout min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-gray-200 bg-white px-2 dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => navigate('/admin/raffles')}
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="목록으로"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h1 className="flex-1 truncate text-base font-bold text-gray-800 dark:text-white">래플 상세</h1>
      </header>

      <main className="p-4 pb-28">
        {loading && <p className="text-center text-gray-500">불러오는 중...</p>}
        {!loading && err && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{err}</p>}
        {!loading && row && (
          <div className="mx-auto max-w-[480px] space-y-4">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="aspect-[4/3] w-full bg-gray-100 dark:bg-gray-900">
                <img src={row.image_url} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {kindLabel(row.kind)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.max(1, Number(row.duration_days) || 7)}일 래플
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-extrabold text-gray-900 dark:text-white">{row.title}</h2>
                {row.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {row.description}
                  </p>
                ) : null}
                {row.kind === 'ongoing' && row.ends_at && (
                  <p className="mt-3 text-sm font-medium text-sky-700 dark:text-sky-300">
                    종료 예정: {new Date(row.ends_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (
                    {formatDaysLeftKorean(row.ends_at)})
                  </p>
                )}
                {row.kind === 'scheduled' && row.ends_at && (
                  <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
                    예약 취소: {new Date(row.ends_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}(서울) 이후 자동
                    삭제됩니다.
                  </p>
                )}
              </div>
            </div>

            {(row.kind === 'scheduled' || row.kind === 'ongoing') && (
              <div className="flex flex-col gap-2">
                {row.kind === 'scheduled' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStartOpen(true)}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    래플 시작
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEndOpen(true)}
                  className="w-full rounded-xl border border-amber-600 py-3 text-sm font-bold text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-500 dark:text-amber-100 dark:hover:bg-amber-950/40"
                >
                  래플 종료
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={goEdit}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                정보 수정
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-rose-600 hover:underline disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </main>

      {startOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="m-0 text-[16px] font-extrabold text-gray-900 dark:text-gray-50">시작 방식</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
              <strong>지금 시작</strong>: 이 순간부터 N×24시간 후 종료.
              <br />
              <strong>00시 시작</strong>: 서울 오늘 0시~N일차 0시.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onStartImmediate}
                className="w-full rounded-xl bg-emerald-600 py-3 text-[13px] font-bold text-white disabled:opacity-50"
              >
                지금 시작
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onStartMidnight}
                className="w-full rounded-xl border border-gray-300 py-3 text-[13px] font-bold text-gray-900 dark:border-gray-600 dark:text-gray-100 disabled:opacity-50"
              >
                00시 시작 (서울)
              </button>
              <button type="button" disabled={busy} onClick={() => setStartOpen(false)} className="py-2 text-[13px] text-gray-600">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {endOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h3 className="m-0 text-[16px] font-extrabold text-gray-900 dark:text-gray-50">종료 방식</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
              {row?.kind === 'scheduled' ? (
                <>
                  <strong>지금 종료</strong>: 예정 래플을 즉시 삭제합니다.
                  <br />
                  <strong>00시 종료</strong>: 다음 서울 0시에 자동 삭제되도록 예약합니다.
                </>
              ) : (
                <>
                  <strong>지금 종료</strong>: 즉시 완료 처리합니다.
                  <br />
                  <strong>00시 종료</strong>: 다음 서울 0시에 맞춰 종료 시각을 설정합니다.
                </>
              )}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onEndNow}
                className="w-full rounded-xl bg-rose-600 py-3 text-[13px] font-bold text-white disabled:opacity-50"
              >
                지금 종료
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onEndMidnight}
                className="w-full rounded-xl border border-gray-300 py-3 text-[13px] font-bold text-gray-900 dark:border-gray-600 dark:text-gray-100 disabled:opacity-50"
              >
                00시 종료 (서울)
              </button>
              <button type="button" disabled={busy} onClick={() => setEndOpen(false)} className="py-2 text-[13px] text-gray-600">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRaffleDetailScreen;
