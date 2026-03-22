import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Image, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useFeedVideo } from '../contexts/FeedVideoContext';
import { COLORS } from '../constants/styles';

/**
 * 메인 피드 가로 캐러셀 — 이미지·동영상 혼합, 전역 1개 재생(FeedVideoContext)
 * playPriority: 작을수록 우선 (지금 여기는 0, 핫플 1, 추천 2)
 */
export default function MainHorizontalMedia({
  width,
  height,
  mediaItems,
  instanceId,
  style,
  playPriority = 100,
}) {
  const { activePlayerId, playGeneration, requestPlay, release } = useFeedVideo();
  const [page, setPage] = useState(0);
  const [videoMuted, setVideoMuted] = useState(true);
  const list = useMemo(() => (Array.isArray(mediaItems) && mediaItems.length > 0 ? mediaItems : []), [mediaItems]);
  const lastVideoIdRef = useRef(null);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, list.length - 1)));
  }, [list.length]);

  useEffect(() => {
    setVideoMuted(true);
  }, [page]);

  useEffect(() => {
    if (lastVideoIdRef.current) {
      release(lastVideoIdRef.current);
      lastVideoIdRef.current = null;
    }
    const cur = list[page];
    if (cur?.type === 'video') {
      const id = `${instanceId}-p${page}`;
      lastVideoIdRef.current = id;
      requestPlay(id, playPriority);
    }
  }, [page, list, instanceId, playPriority, requestPlay, release, playGeneration]);

  useEffect(() => {
    return () => {
      if (lastVideoIdRef.current) release(lastVideoIdRef.current);
    };
  }, [instanceId, release]);

  const onMomentumScrollEnd = useCallback(
    (e) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / width);
      setPage(Math.max(0, Math.min(next, Math.max(0, list.length - 1))));
    },
    [width, list.length]
  );

  if (list.length === 0) {
    return (
      <View style={[styles.placeholder, { width, height }, style]}>
        <Ionicons name="image-outline" size={40} color={COLORS.textSubtle} />
        <Text style={styles.placeholderText}>미리보기 없음</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={onMomentumScrollEnd}
      style={[{ width, height }, style]}
    >
      {list.map((item, i) => {
        const playerId = `${instanceId}-p${i}`;
        const isVideo = item.type === 'video';
        const shouldPlay = isVideo && activePlayerId === playerId;

        return (
          <View key={`${playerId}-${item.uri}`} style={{ width, height, backgroundColor: '#1a1a1a' }}>
            {isVideo ? (
              <>
                {item.posterUri ? (
                  <Image
                    source={{ uri: item.posterUri }}
                    style={[StyleSheet.absoluteFill, { opacity: shouldPlay ? 0 : 1 }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[StyleSheet.absoluteFill, styles.videoPosterFallback, shouldPlay && styles.posterHidden]}
                    pointerEvents="none"
                  >
                    <Ionicons name="videocam" size={36} color="rgba(255,255,255,0.85)" />
                  </View>
                )}
                <Video
                  source={{ uri: item.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode={ResizeMode.COVER}
                  isLooping
                  shouldPlay={shouldPlay}
                  isMuted={videoMuted}
                  useNativeControls={false}
                />
                <View style={styles.videoHint} pointerEvents="none">
                  <Ionicons name="videocam" size={14} color="#fff" />
                </View>
                {isVideo && (
                  <TouchableOpacity
                    style={styles.soundToggle}
                    onPress={() => setVideoMuted((m) => !m)}
                    activeOpacity={0.85}
                    accessibilityLabel={videoMuted ? '소리 켜기' : '소리 끄기'}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={videoMuted ? 'volume-mute' : 'volume-high'}
                      size={22}
                      color="#fff"
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Image source={{ uri: item.uri }} style={{ width, height }} resizeMode="cover" />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e8eaed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  placeholderText: { fontSize: 12, color: COLORS.textSubtle, fontWeight: '600' },
  videoPosterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2d2d2d',
  },
  posterHidden: {
    opacity: 0,
  },
  videoHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  soundToggle: {
    position: 'absolute',
    bottom: 14,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
