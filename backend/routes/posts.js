const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const jwt = require('jsonwebtoken');
const Post = require('../models/Post');
const User = require('../models/User');
const { generateSmartTags, CATEGORY_SLUGS, CATEGORY_DISPLAY } = require('../services/aiTagService');
const { getJwtSecret } = require('../config/secrets');

const normalizeCategory = (c) => {
  const v = String(c || '').trim().toLowerCase();
  if (CATEGORY_SLUGS.includes(v)) return v;
  return 'general';
};

const normalizeCategoriesList = (arr) => {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map(normalizeCategory).filter((s) => CATEGORY_SLUGS.includes(s)))];
};

const categorySlugsToNames = (slugs) =>
  (slugs || []).map((s) => CATEGORY_DISPLAY[s]?.name || s).filter(Boolean).join(', ');

// JWT에서 userId 추출 (auth 라우트와 동일한 payload: userId)
const getUserIdFromReq = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
};

// MongoDB ObjectId 유효성 검사 (24자 hex)
const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(id);
};

// 모든 태그 및 AI 라벨 집계 조회
router.get('/tags', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        tags: [],
        message: 'Mock 모드: DB 연결이 없습니다.'
      });
    }

    const posts = await Post.find({ isPublic: true, isBlocked: false }).select('tags aiLabels');

    const tagMap = new Map();

    posts.forEach(post => {
      // 일반 태그 처리
      if (post.tags && Array.isArray(post.tags)) {
        post.tags.forEach(tag => {
          if (!tag) return;
          const normalized = tag.trim();
          if (!normalized) return;
          tagMap.set(normalized, (tagMap.get(normalized) || 0) + 1);
        });
      }

      // AI 라벨 처리
      if (post.aiLabels && Array.isArray(post.aiLabels)) {
        post.aiLabels.forEach(label => {
          if (!label || !label.name) return;
          const normalized = label.name.trim();
          if (!normalized) return;
          tagMap.set(normalized, (tagMap.get(normalized) || 0) + 1);
        });
      }
    });

    const tags = Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 100); // 상위 100개만 반환

    res.json({
      success: true,
      tags,
      message: '태그 목록을 성공적으로 불러왔습니다.'
    });
  } catch (error) {
    console.error('태그 조회 오류:', error);
    res.status(500).json({ success: false, error: '태그 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// 게시물 목록 조회
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, posts: [], message: 'DB 연결이 없습니다.' });
    }

    const { category, tag, sort = 'latest', limit = 20, page = 1 } = req.query;

    // 필터 조건 구성 (카테고리 + 태그 동시 사용 시 $and로 결합)
    const query = { isPublic: true, isBlocked: false };
    const andParts = [];

    if (category && category !== 'all') {
      andParts.push({
        $or: [{ category: category }, { categories: category }]
      });
    }

    if (tag) {
      const raw = String(tag).trim().replace(/^#+/, '');
      const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^${esc}$`, 'i');
      andParts.push({ $or: [{ tags: re }, { 'aiLabels.name': re }] });
    }

    if (andParts.length === 1) {
      Object.assign(query, andParts[0]);
    } else if (andParts.length > 1) {
      query.$and = andParts;
    }

    // 정렬 조건 구성
    let sortOption = { createdAt: -1 }; // 최신순 (기본)
    if (sort === 'popular') {
      sortOption = { likes: -1, createdAt: -1 };
    }

    const posts = await Post.find(query)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'name avatar') // 작성자 정보 포함
      .lean();

    res.json({
      success: true,
      posts,
      message: '게시물 목록을 성공적으로 불러왔습니다.'
    });
  } catch (error) {
    console.error('게시물 조회 오류:', error.message || error);
    res.status(500).json({ success: false, error: '게시물 목록을 불러오는 중 오류가 발생했습니다.'     });
  }
});

// 정보가 정확해요 토글 (다른 사용자가 누르면 게시물 작성자 신뢰지수 상승)
router.post('/:id/accuracy', async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'DB 연결이 없습니다.' });
    }
    if (!isValidObjectId(postId)) {
      return res.status(404).json({ success: false, error: '게시물을 찾을 수 없습니다.' });
    }
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: '게시물을 찾을 수 없습니다.' });
    }
    const marked = (post.accuracyMarkedBy || []).some(
      (oid) => oid && oid.toString() === userId.toString()
    );
    if (marked) {
      await post.removeAccuracyMark(userId);
      return res.json({
        success: true,
        marked: false,
        accuracyCount: post.accuracyCount || 0
      });
    }
    await post.addAccuracyMark(userId);
    const updated = await Post.findById(postId).select('accuracyCount accuracyMarkedBy').lean();
    return res.json({
      success: true,
      marked: true,
      accuracyCount: updated.accuracyCount || 0
    });
  } catch (error) {
    console.error('정확해요 토글 오류:', error.message || error);
    res.status(500).json({ success: false, error: '처리 중 오류가 발생했습니다.' });
  }
});

// 게시물 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // DB 미연결 시: 200 + post null 반환 (프론트에서 localStorage 등 사용 가능)
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        post: null,
        message: 'DB 연결이 없습니다. 로컬 데이터를 사용해 주세요.'
      });
    }

    // ID가 MongoDB ObjectId 형식이 아니면 404 (로컬 전용 ID일 수 있음)
    if (!isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        error: '게시물을 찾을 수 없습니다.',
        code: 'INVALID_ID'
      });
    }

    const post = await Post.findById(id)
      .populate('user', 'name avatar')
      .populate('comments.user', 'name avatar');

    if (!post) {
      return res.status(404).json({ success: false, error: '게시물을 찾을 수 없습니다.' });
    }

    // 조회수 증가 (실패해도 응답은 성공으로)
    try {
      post.views += 1;
      await post.save();
    } catch (saveErr) {
      console.warn('조회수 저장 실패 (무시):', saveErr.message);
    }

    const userId = getUserIdFromReq(req);
    const postObj = post.toObject ? post.toObject() : { ...post };
    postObj.accuracyCount = post.accuracyCount ?? 0;
    postObj.userMarked = !!(
      userId &&
      (post.accuracyMarkedBy || []).some((oid) => oid && oid.toString() === userId.toString())
    );

    res.json({
      success: true,
      post: postObj,
      message: '게시물 상세 정보'
    });
  } catch (error) {
    console.error('게시물 상세 조회 오류:', error.message || error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, error: '잘못된 게시물 ID입니다.' });
    }
    res.status(500).json({
      success: false,
      error: '게시물 상세 조회 중 오류가 발생했습니다.',
      ...(process.env.NODE_ENV !== 'production' && { detail: error.message })
    });
  }
});

// 게시물 생성
router.post('/', async (req, res) => {
  try {
    // TODO: 실제 인증 미들웨어가 붙으면 req.user.id 사용
    // 현재는 요청 바디에서 userId를 받거나(테스트용), 임의의 사용자 할당
    let userId = req.body.userId;

    // 테스트용: 사용자가 없으면 첫 번째 사용자 찾아서 할당
    if (!userId) {
      const user = await User.findOne();
      if (user) userId = user._id;
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: '로그인이 필요합니다.' });
    }

    const {
      content,
      location: locationRaw,
      detailedLocation,
      coordinates: coordinatesRaw,
      images,
      tags,
      category,
      categoryName,
      categories: categoriesRaw,
      placeName,
      exifData
    } = req.body;

    // location: 프론트가 문자열 또는 { name, lat, lon, region, country } 객체로 보낼 수 있음
    let locationStr = '알 수 없는 위치';
    let coordinates = coordinatesRaw;
    if (typeof locationRaw === 'string' && locationRaw.trim()) {
      locationStr = locationRaw.trim();
    } else if (locationRaw && typeof locationRaw === 'object') {
      locationStr = locationRaw.name || locationRaw.region || locationRaw.address || '알 수 없는 위치';
      if (locationRaw.lat != null && (locationRaw.lon != null || locationRaw.lng != null)) {
        const lng = locationRaw.lng ?? locationRaw.lon;
        coordinates = { lat: locationRaw.lat, lng };
      }
    }

    const newPost = new Post({
      user: userId,
      note: content,
      location: locationStr,
      detailedLocation: detailedLocation || locationStr,
      placeName: placeName || locationStr,
      coordinates: coordinates
        ? {
            type: 'Point',
            coordinates: [Number(coordinates.lng), Number(coordinates.lat)]
          }
        : undefined,
      images: Array.isArray(images) ? images : [],
      tags: Array.isArray(tags) ? tags : [],
      category: normalizeCategory(category),
      categoryName: (categoryName && String(categoryName).trim()) || '일반',
      categories: []
    });

    let catList = normalizeCategoriesList(categoriesRaw);
    if (catList.length === 0) catList = [normalizeCategory(category)];
    newPost.categories = catList;
    newPost.category = catList[0];
    newPost.categoryName = categorySlugsToNames(catList) || newPost.categoryName;

    // 🔹 AI 태그·카테고리 (GEMINI_API_KEY가 설정된 경우만) — 다중 카테고리 병합
    try {
      const primaryImage = Array.isArray(images) && images.length > 0 ? images[0] : null;
      if (primaryImage && typeof primaryImage === 'string' && primaryImage.startsWith('/uploads/')) {
        const imagePath = path.join(__dirname, '..', primaryImage);
        const aiResult = await generateSmartTags(imagePath, locationStr, exifData || null);

        if (aiResult && aiResult.success) {
          const fromAi = Array.isArray(aiResult.categories) && aiResult.categories.length
            ? aiResult.categories.map((c) => c.category).filter((s) => CATEGORY_SLUGS.includes(s))
            : (aiResult.category && CATEGORY_SLUGS.includes(aiResult.category) ? [aiResult.category] : []);
          if (fromAi.length) {
            newPost.categories = [...new Set([...(newPost.categories || []), ...fromAi])];
            newPost.category = newPost.categories[0];
            newPost.categoryName = categorySlugsToNames(newPost.categories) || newPost.categoryName;
          }
          if (Array.isArray(aiResult.tags) && aiResult.tags.length > 0) {
            newPost.aiLabels = aiResult.tags.map((t) => ({
              name: t,
              confidence: 1
            }));
            newPost.aiProcessed = true;

            const baseTags = Array.isArray(newPost.tags)
              ? newPost.tags.map((t) => String(t).replace(/^#+/, '').trim())
              : [];
            const merged = Array.from(new Set([...baseTags, ...aiResult.tags].filter(Boolean)));
            newPost.tags = merged;
          }
        }
      }
    } catch (aiError) {
      console.error('AI 태그 생성 중 오류 (게시물 저장은 계속 진행):', aiError.message || aiError);
    }

    await newPost.save();

    res.status(201).json({
      success: true,
      post: newPost,
      message: '게시물이 등록되었습니다.'
    });
  } catch (error) {
    console.error('게시물 생성 오류:', error);
    res.status(500).json({ success: false, error: '게시물 등록 중 오류가 발생했습니다.' });
  }
});

// 게시물 삭제
router.delete('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, error: 'DB 연결이 없습니다.' });
    }
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, error: '게시물을 찾을 수 없습니다.' });
    }
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: '게시물을 찾을 수 없습니다.' });
    }
    res.json({ success: true, message: '게시물이 삭제되었습니다.' });
  } catch (error) {
    console.error('게시물 삭제 오류:', error.message || error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, error: '잘못된 게시물 ID입니다.' });
    }
    res.status(500).json({ success: false, error: '게시물 삭제 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
