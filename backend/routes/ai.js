const express = require('express');
const rateLimit = require('express-rate-limit');
const { generatePlaceDescription } = require('../services/placeDescriptionService');

const router = express.Router();

// AI 계열은 비용/남용 방지를 위해 더 타이트하게
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 20 : 120)),
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(aiLimiter);

/**
 * POST /api/ai/place-description
 * body: { placeKey, regionHint?, tier?, tags?: string[], userCaptions?: string[] }
 */
router.post('/place-description', async (req, res) => {
  try {
    const { placeKey, regionHint, tier, tags, userCaptions } = req.body || {};
    const out = await generatePlaceDescription({
      placeKey,
      regionHint,
      tier,
      tags,
      userCaptions,
    });
    if (!out.ok) {
      return res.status(400).json({ success: false, error: out.error || 'failed' });
    }
    return res.json({
      success: true,
      description: out.description || '',
      cached: !!out.cached,
      method: out.description ? 'gemini-text' : 'disabled',
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || 'server error' });
  }
});

module.exports = router;

