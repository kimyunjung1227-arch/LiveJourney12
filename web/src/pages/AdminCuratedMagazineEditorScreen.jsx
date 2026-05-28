import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchMagazineById,
  createMagazine,
  updateMagazine,
} from '../api/curatedMagazinesSupabase';
import { uploadImage } from '../api/upload';
import { logger } from '../utils/logger';

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
  switch (type) {
    case 'text':
      return { _key: Math.random().toString(36).slice(2), type: 'text', body: '' };
    case 'place':
      return {
        _key: Math.random().toString(36).slice(2),
        type: 'place',
        name: '',
        address: '',
        image_url: '',
        description: '',
        tip: '',
      };
    case 'image':
      return {
        _key: Math.random().toString(36).slice(2),
        type: 'image',
        image_url: '',
        caption: '',
      };
    default:
      return null;
  }
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
          blocks: withKeys(data.blocks),
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
          <Field label="부제 (한 줄 요약)">
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => setField('subtitle', e.target.value)}
              placeholder="3곳의 라이브 현장에서 만나는 진짜 색"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </Field>
          <Field label="대표 지역 (선택)">
            <input
              type="text"
              value={form.region}
              onChange={(e) => setField('region', e.target.value)}
              placeholder="제주 / 서울 / 강릉 ..."
              className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </Field>
          <Field label="인트로 (커버 아래 첫 문단)">
            <textarea
              value={form.intro_body}
              onChange={(e) => setField('intro_body', e.target.value)}
              rows={4}
              placeholder="이 매거진을 한 줄로 소개해 보세요"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            />
          </Field>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">본문 블록</h2>
            <span className="text-[11px] text-gray-500">{form.blocks.length} 개</span>
          </div>

          <div className="space-y-3">
            {form.blocks.map((b, idx) => (
              <BlockEditor
                key={b._key}
                block={b}
                index={idx}
                total={form.blocks.length}
                onChange={(patch) => updateBlock(idx, patch)}
                onRemove={() => removeBlock(idx)}
                onMoveUp={() => moveBlock(idx, -1)}
                onMoveDown={() => moveBlock(idx, +1)}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <AddButton label="텍스트" icon="text_fields" onClick={() => addBlock('text')} />
            <AddButton label="여행지" icon="place" onClick={() => addBlock('place')} />
            <AddButton label="이미지" icon="image" onClick={() => addBlock('image')} />
          </div>
        </section>
      </main>
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

function AddButton({ label, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-[12px] font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-1"
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {label}
    </button>
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

function BlockEditor({ block, index, total, onChange, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-gray-500">
          #{index + 1} · {labelFor(block.type)}
        </span>
        <div className="flex items-center gap-1">
          <IconBtn icon="arrow_upward" onClick={onMoveUp} disabled={index === 0} />
          <IconBtn icon="arrow_downward" onClick={onMoveDown} disabled={index === total - 1} />
          <IconBtn icon="delete" onClick={onRemove} danger />
        </div>
      </div>

      {block.type === 'text' && (
        <textarea
          value={block.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={4}
          placeholder="본문 내용을 입력하세요"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        />
      )}

      {block.type === 'image' && (
        <ImageBlockEditor block={block} onChange={onChange} />
      )}

      {block.type === 'place' && (
        <PlaceBlockEditor block={block} onChange={onChange} />
      )}
    </div>
  );
}

const labelFor = (type) => {
  switch (type) {
    case 'text':
      return '텍스트';
    case 'place':
      return '여행지';
    case 'image':
      return '이미지';
    default:
      return type;
  }
};

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

function ImageBlockEditor({ block, onChange }) {
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
        className="w-full h-36 rounded-lg border border-dashed border-gray-300 overflow-hidden flex items-center justify-center"
        style={{
          backgroundImage: block.image_url ? `url(${block.image_url})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          background: block.image_url ? undefined : '#F5F7FA',
        }}
      >
        {!block.image_url && (
          <span className="text-xs text-gray-500">
            {uploading ? '업로드 중...' : '이미지 선택'}
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <input
        type="text"
        value={block.caption}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="캡션 (선택)"
        className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
      />
    </div>
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
      <input
        type="text"
        value={block.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="장소명 (예: 혼인지)"
        className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-bold"
      />
      <input
        type="text"
        value={block.address}
        onChange={(e) => onChange({ address: e.target.value })}
        placeholder="주소 또는 위치 설명"
        className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
      />
      <textarea
        value={block.description}
        onChange={(e) => onChange({ description: e.target.value })}
        rows={3}
        placeholder="이 곳을 추천하는 이유, 분위기, 동선 등"
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
      />
      <textarea
        value={block.tip}
        onChange={(e) => onChange({ tip: e.target.value })}
        rows={2}
        placeholder="현장 팁 (예: 평일 오전 추천, 주차장 협소 등)"
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
      />
    </div>
  );
}
