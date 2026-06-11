import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchMagazineById,
  createMagazine,
  updateMagazine,
} from '../api/curatedMagazinesSupabase';
import { uploadImage } from '../api/upload';
import { logger } from '../utils/logger';
import { parseCuratedMagazinePaste } from '../utils/parseCuratedMagazinePaste';

const emptyForm = {
  title: '',
  subtitle: '',
  region: '',
  cover_image_url: '',
  intro_body: '',
  blocks: [],
  status: 'draft',
};

const newBlock = (type) => {
  if (type !== 'place') return null;
  return {
    _key: Math.random().toString(36).slice(2),
    type: 'place',
    name: '',
    address: '',
    image_url: '',
    description: '',
    nearby: [],
  };
};

const withKeys = (blocks) =>
  (Array.isArray(blocks) ? blocks : []).map((b) => ({
    ...b,
    _key: b._key || Math.random().toString(36).slice(2),
  }));

const stripKeys = (blocks) =>
  (Array.isArray(blocks) ? blocks : []).map(({ _key, ...rest }) => rest);

export default function AdminCuratedMagazineEditorScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await fetchMagazineById(id);
      if (cancelled) return;
      if (data) {
        setForm({
          title: data.title || '',
          subtitle: data.subtitle || '',
          region: data.region || '',
          cover_image_url: data.cover_image_url || '',
          intro_body: data.intro_body || '',
          // 장소 전용 구조 — place 블록만 유지
          blocks: withKeys((Array.isArray(data.blocks) ? data.blocks : []).filter((b) => b?.type === 'place')),
          status: data.status || 'draft',
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const setField = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const updateBlock = (idx, patch) =>
    setForm((s) => {
      const next = [...s.blocks];
      next[idx] = { ...next[idx], ...patch };
      return { ...s, blocks: next };
    });

  const addBlock = (type) => {
    const b = newBlock(type);
    if (!b) return;
    setForm((s) => ({ ...s, blocks: [...s.blocks, b] }));
  };

  const removeBlock = (idx) =>
    setForm((s) => ({ ...s, blocks: s.blocks.filter((_, i) => i !== idx) }));

  const moveBlock = (idx, dir) =>
    setForm((s) => {
      const next = [...s.blocks];
      const ni = idx + dir;
      if (ni < 0 || ni >= next.length) return s;
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return { ...s, blocks: next };
    });

  const applyPaste = (raw, mode = 'replace') => {
    const parsed = parseCuratedMagazinePaste(raw);
    if (!parsed) {
      // eslint-disable-next-line no-alert
      window.alert('붙여넣은 내용에서 정보를 찾지 못했어요.');
      return;
    }
    const parsedPlaces = (Array.isArray(parsed.blocks) ? parsed.blocks : []).filter((b) => b?.type === 'place');
    setForm((s) => {
      const next = { ...s };
      if (mode === 'replace') {
        if (parsed.title) next.title = parsed.title;
        if (parsed.subtitle) next.subtitle = parsed.subtitle;
        next.blocks = withKeys(parsedPlaces);
      } else {
        if (!s.title && parsed.title) next.title = parsed.title;
        if (!s.subtitle && parsed.subtitle) next.subtitle = parsed.subtitle;
        next.blocks = [...s.blocks, ...withKeys(parsedPlaces)];
      }
      return next;
    });
    setPasteOpen(false);
  };

  const save = async (status) => {
    if (!form.title.trim()) {
      // eslint-disable-next-line no-alert
      window.alert('제목을 입력하세요.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        subtitle: form.subtitle,
        region: form.region,
        cover_image_url: form.cover_image_url,
        intro_body: form.intro_body,
        blocks: stripKeys(form.blocks),
        status,
      };
      const res = isEdit
        ? await updateMagazine(id, payload)
        : await createMagazine(payload);
      if (res.success) {
        navigate('/admin/curated-magazines', { replace: true });
      } else {
        // eslint-disable-next-line no-alert
        window.alert(`저장 실패: ${res.error}`);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        불러오는 중...
      </div>
    );
  }

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
        <h1 className="text-base font-bold text-gray-800 dark:text-white">
          {isEdit ? '매거진 편집' : '매거진 발행'}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="px-3 h-9 rounded-lg border border-gray-300 dark:border-gray-600 text-[12px] font-bold text-gray-800 dark:text-gray-100"
            title="다른 글을 통째로 붙여넣으면 자동으로 분류해서 채워줍니다"
          >
            📋 일괄 붙여넣기
          </button>
          <button
            type="button"
            onClick={() => save('draft')}
            disabled={busy}
            className="px-3 h-9 rounded-lg border border-gray-300 dark:border-gray-600 text-[12px] font-bold text-gray-800 dark:text-gray-100 disabled:opacity-60"
          >
            임시저장
          </button>
          <button
            type="button"
            onClick={() => save('published')}
            disabled={busy}
            className="px-3 h-9 rounded-lg bg-primary text-white text-[12px] font-bold disabled:opacity-60"
          >
            {form.status === 'published' ? '재발행' : '발행'}
          </button>
        </div>
      </header>

      {pasteOpen && (
        <PasteModal
          onClose={() => setPasteOpen(false)}
          onApply={applyPaste}
          hasExisting={!!form.title || form.blocks.length > 0}
        />
      )}

      <main className="p-4 pb-24 space-y-5">
        <CoverImagePicker
          value={form.cover_image_url}
          onChange={(url) => setField('cover_image_url', url)}
        />

        <section className="space-y-3">
          <Field label="대표 제목 *">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="제주에서 5월 끝까지 즐기는 수국 산책"
              className="w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-[15px]"
            />
          </Field>
          <Field label="부제목 (한 줄 요약)">
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => setField('subtitle', e.target.value)}
              placeholder="3곳의 라이브 현장에서 만나는 진짜 색"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </Field>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">장소</h2>
            <span className="text-[11px] text-gray-500">{form.blocks.length} 곳</span>
          </div>

          {form.blocks.length === 0 && (
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-2 px-1">
              아래 “+ 장소 추가”로 장소를 하나씩 넣어주세요. 각 장소마다 이름·위치·설명·주변장소를 입력합니다.
            </p>
          )}

          <div className="space-y-3">
            {form.blocks.map((b, idx) => (
              <PlaceCard
                key={b._key}
                block={b}
                number={idx + 1}
                index={idx}
                total={form.blocks.length}
                onChange={(patch) => updateBlock(idx, patch)}
                onRemove={() => removeBlock(idx)}
                onMoveUp={() => moveBlock(idx, -1)}
                onMoveDown={() => moveBlock(idx, +1)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => addBlock('place')}
            className="w-full h-11 mt-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-[13px] font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            장소 추가
          </button>
        </section>
      </main>
    </div>
  );
}

function PasteModal({ onClose, onApply, hasExisting }) {
  const [text, setText] = useState('');
  const taRef = useRef(null);
  useEffect(() => {
    taRef.current?.focus();
  }, []);
  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            글 통째로 붙여넣기
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-100"
            aria-label="닫기"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <details className="mb-3">
          <summary className="text-[12px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
            분류 가이드 (선택) — 라벨로 정확히 분류하려면 여기 참고
          </summary>
          <pre className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-[11px] leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-200">
{`[제목]
제주에서 5월 끝까지 즐기는 수국 산책

[부제]
3곳의 라이브 현장에서 만나는 진짜 색

[지역]
제주

[인트로]
5월 말부터 제주의 길은 한 주 단위로 색이 바뀝니다…

[본문]
첫 번째 단락. 빈 줄로 단락이 나뉘면 자동으로 분리됩니다.

두 번째 단락.

[장소: 혼인지]
장소위치: 제주특별자치도 서귀포시 표선면
장소설명: 6월 초 만개 / 산책로 자체가 곱고…
주변장소: 표선해변, 제주민속촌

[장소: 카멜리아힐]
장소위치: 제주특별자치도 서귀포시 안덕면
장소설명: 정원이 넓어 여유 있는 동선…
주변장소: 오설록, 본태박물관`}
          </pre>
          <p className="text-[10.5px] text-gray-500 mt-2">
            라벨이 하나도 없으면 첫 줄을 제목, 두 번째 줄(80자 이하)을 부제, 그 다음 단락을 인트로로 자동 추정합니다.
          </p>
        </details>

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder="여기에 글을 통째로 붙여넣으세요"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-mono"
        />

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-bold"
          >
            취소
          </button>
          {hasExisting && (
            <button
              type="button"
              onClick={() => onApply(text, 'append')}
              disabled={!text.trim()}
              className="flex-1 h-11 rounded-lg border border-primary text-primary text-sm font-bold disabled:opacity-50"
            >
              이어 붙이기
            </button>
          )}
          <button
            type="button"
            onClick={() => onApply(text, 'replace')}
            disabled={!text.trim()}
            className="flex-1 h-11 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
          >
            {hasExisting ? '덮어쓰기' : '자동 분류'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CoverImagePicker({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const pick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImage(file);
      if (res?.success && res.url) {
        onChange(res.url);
      } else {
        // eslint-disable-next-line no-alert
        window.alert('이미지 업로드 실패');
      }
    } catch (err) {
      logger.warn('cover upload 실패', err?.message || err);
      // eslint-disable-next-line no-alert
      window.alert('이미지 업로드 실패');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
        커버 이미지 (배경)
      </span>
      <button
        type="button"
        onClick={pick}
        className="mt-1 w-full h-44 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 overflow-hidden relative flex items-center justify-center"
        style={{
          backgroundImage: value ? `url(${value})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          background: value ? undefined : '#F5F7FA',
        }}
      >
        {!value && (
          <div className="text-center">
            <span className="material-symbols-outlined text-3xl text-gray-400">
              add_photo_alternate
            </span>
            <p className="text-xs text-gray-500 mt-1">
              {uploading ? '업로드 중...' : '커버 이미지 추가'}
            </p>
          </div>
        )}
        {value && (
          <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition flex items-center justify-center text-white text-sm">
            {uploading ? '업로드 중...' : '변경'}
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}

function PlaceCard({ block, number, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-extrabold text-primary">장소 {number}</span>
        <div className="flex items-center gap-1">
          <IconBtn icon="arrow_upward" onClick={onMoveUp} disabled={index === 0} />
          <IconBtn icon="arrow_downward" onClick={onMoveDown} disabled={index === total - 1} />
          <IconBtn icon="delete" onClick={onRemove} danger />
        </div>
      </div>
      <PlaceBlockEditor block={block} onChange={onChange} />
    </div>
  );
}

function IconBtn({ icon, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-md flex items-center justify-center disabled:opacity-30 ${
        danger
          ? 'text-red-500 hover:bg-red-50'
          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

function PlaceBlockEditor({ block, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const pick = () => inputRef.current?.click();
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const res = await uploadImage(f);
      if (res?.success && res.url) onChange({ image_url: res.url });
      else window.alert('업로드 실패'); // eslint-disable-line no-alert
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pick}
        className="w-full h-40 rounded-lg border border-dashed border-gray-300 overflow-hidden flex items-center justify-center"
        style={{
          backgroundImage: block.image_url ? `url(${block.image_url})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          background: block.image_url ? undefined : '#F5F7FA',
        }}
      >
        {!block.image_url && (
          <span className="text-xs text-gray-500">
            {uploading ? '업로드 중...' : '여행지 사진'}
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <PlaceField label="장소이름">
        <input
          type="text"
          value={block.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="예: 혼인지"
          className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-bold"
        />
      </PlaceField>

      <PlaceField label="장소위치">
        <input
          type="text"
          value={block.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="예: 제주특별자치도 서귀포시 표선면"
          className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        />
      </PlaceField>

      <PlaceField label="장소설명">
        <textarea
          value={block.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          placeholder="이 곳을 추천하는 이유, 분위기, 동선 등"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        />
      </PlaceField>

      <div>
        <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
          주변장소 (최대 3곳 · 사진은 장소이름으로 자동)
        </span>
        <div className="mt-1">
          <NearbyEditor items={block.nearby} onChange={(v) => onChange({ nearby: v })} />
        </div>
      </div>
    </div>
  );
}

/** 주변장소 입력: 최대 3곳, 각 곳마다 이름 + 간단한 설명 (사진은 화면에서 이름으로 자동 매칭) */
function NearbyEditor({ items, onChange }) {
  const list = Array.isArray(items)
    ? items.map((it) =>
        typeof it === 'string' ? { name: it, desc: '' } : { name: it?.name || '', desc: it?.desc || '' }
      )
    : typeof items === 'string' && items.trim()
    ? items
        .split(/,|·|•|ㆍ|\n/)
        .map((s) => ({ name: s.trim(), desc: '' }))
        .filter((n) => n.name)
    : [];

  const update = (i, patch) => onChange(list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () => onChange([...list, { name: '', desc: '' }]);
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {list.map((it, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-2 space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400">주변장소 {i + 1}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-[11px] font-semibold text-red-500"
            >
              삭제
            </button>
          </div>
          <input
            type="text"
            value={it.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="장소이름 (예: 석굴암)"
            className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-semibold"
          />
          <input
            type="text"
            value={it.desc}
            onChange={(e) => update(i, { desc: e.target.value })}
            placeholder="간단한 설명 (예: 통일신라 석굴 사원)"
            className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
      ))}
      {list.length < 3 && (
        <button
          type="button"
          onClick={add}
          className="w-full h-9 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-[12px] font-bold text-gray-600 dark:text-gray-300"
        >
          + 주변장소 추가
        </button>
      )}
    </div>
  );
}

function PlaceField({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
