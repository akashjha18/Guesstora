import { Router } from 'express';
import { requireOwner, requireRole, requireStaff } from '../auth.js';
import {
  analyzeMenuEngineering,
  computeRfmSegments,
  createWinbackCampaign,
  generatePrepForecast,
  getDynamicUpsellSuggestions,
  launchCampaignBroadcast,
  mineAffinityRules,
  simulatePriceAdjustments,
} from '../aiRoasteryEngine.js';
import {
  AiAffinityRule,
  AiCampaignRecipient,
  AiMarketingCampaign,
  AiPrepForecast,
} from '../models.js';

export const aiRoasteryRouter = Router();

// ============================================================================
// PUBLIC / POS / QR UPSELL ENDPOINTS
// ============================================================================

aiRoasteryRouter.get('/upsell', async (req, res) => {
  try {
    const cafeId = req.query.cafeId || req.auth?.cafe;
    if (!cafeId) {
      return res.status(400).json({ message: 'cafeId is required for upsell suggestions.' });
    }

    let itemIds = [];
    if (req.query.itemIds) {
      if (Array.isArray(req.query.itemIds)) {
        itemIds = req.query.itemIds;
      } else {
        itemIds = String(req.query.itemIds).split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const limit = Number(req.query.limit) || 3;
    const suggestions = await getDynamicUpsellSuggestions({
      cafeId,
      currentItemIds: itemIds,
      limit,
    });

    res.json({ suggestions });
  } catch (err) {
    console.error('Upsell suggestions error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch upsell suggestions.' });
  }
});

// ============================================================================
// OWNER / MANAGER PROTECTED ENDPOINTS
// ============================================================================

// 1. Menu Matrix & BCG Analysis
aiRoasteryRouter.get('/menu-matrix', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { startDate, endDate, category } = req.query;

    const matrix = await analyzeMenuEngineering({
      cafeId,
      startDate,
      endDate,
      category,
    });

    res.json(matrix);
  } catch (err) {
    console.error('Menu matrix analysis error:', err);
    res.status(500).json({ message: err.message || 'Failed to analyze menu matrix.' });
  }
});

aiRoasteryRouter.post('/menu-matrix/simulate', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const { items, adjustments } = req.body;
    if (!items || !adjustments) {
      return res.status(400).json({ message: 'items and adjustments arrays are required for simulation.' });
    }

    const simulation = simulatePriceAdjustments({ items, adjustments });
    res.json(simulation);
  } catch (err) {
    console.error('Price simulation error:', err);
    res.status(500).json({ message: err.message || 'Failed to simulate price adjustments.' });
  }
});

// 2. Predictive Prep & Rush Hour Forecasting
aiRoasteryRouter.get('/prep-forecast', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { targetDate, weatherCondition, isHoliday } = req.query;

    const forecast = await generatePrepForecast({
      cafeId,
      targetDate,
      weatherCondition,
      isHoliday: isHoliday === 'true' || isHoliday === true,
    });

    res.json(forecast);
  } catch (err) {
    console.error('Prep forecast error:', err);
    res.status(500).json({ message: err.message || 'Failed to generate prep forecast.' });
  }
});

aiRoasteryRouter.post('/prep-forecast/acknowledge', requireStaff, async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { targetDate, acknowledgedBy } = req.body;

    const forecast = await AiPrepForecast.findOne({
      where: { cafeId, targetDate },
    });

    if (!forecast) {
      return res.status(404).json({ message: 'Prep forecast not found for specified date.' });
    }

    await forecast.update({
      status: 'acknowledged',
      acknowledgedBy: acknowledgedBy || req.auth.sub || 'Head Barista',
      acknowledgedAt: new Date(),
    });

    res.json({ message: 'Morning batch prep acknowledged.', forecast });
  } catch (err) {
    console.error('Acknowledge prep forecast error:', err);
    res.status(500).json({ message: err.message || 'Failed to acknowledge prep forecast.' });
  }
});

// 3. Smart POS Affinity Rules & Mining
aiRoasteryRouter.get('/affinity-rules', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const rules = await AiAffinityRule.findAll({
      where: { cafeId },
      order: [['lift', 'DESC'], ['confidence', 'DESC']],
    });
    res.json({ rules });
  } catch (err) {
    console.error('Fetch affinity rules error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch affinity rules.' });
  }
});

aiRoasteryRouter.post('/affinity-rules/mine', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const { minSupport, minConfidence } = req.body;

    const minedRules = await mineAffinityRules({
      cafeId,
      minSupport: minSupport ? Number(minSupport) : 0.02,
      minConfidence: minConfidence ? Number(minConfidence) : 0.25,
    });

    res.json({
      message: `Successfully mined ${minedRules.length} affinity basket association rules.`,
      rules: minedRules,
    });
  } catch (err) {
    console.error('Mining affinity rules error:', err);
    res.status(500).json({ message: err.message || 'Failed to mine association rules.' });
  }
});

aiRoasteryRouter.patch('/affinity-rules/:id', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const rule = await AiAffinityRule.findOne({
      where: { id: req.params.id, cafeId },
    });

    if (!rule) {
      return res.status(404).json({ message: 'Affinity rule not found.' });
    }

    const { isActive, pairingDiscount, customPitchText } = req.body;
    const updates = {};
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (pairingDiscount !== undefined) updates.pairingDiscount = Number(pairingDiscount);
    if (customPitchText !== undefined) updates.customPitchText = String(customPitchText);

    await rule.update(updates);
    res.json({ message: 'Rule updated.', rule });
  } catch (err) {
    console.error('Update affinity rule error:', err);
    res.status(500).json({ message: err.message || 'Failed to update affinity rule.' });
  }
});

// 4. Autonomous Guest Win-Back & Retention (RFM)
aiRoasteryRouter.get('/rfm-segments', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const segments = await computeRfmSegments({ cafeId });
    res.json(segments);
  } catch (err) {
    console.error('RFM computation error:', err);
    res.status(500).json({ message: err.message || 'Failed to compute RFM segments.' });
  }
});

aiRoasteryRouter.get('/campaigns', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const campaigns = await AiMarketingCampaign.findAll({
      where: { cafeId },
      order: [['createdAt', 'DESC']],
    });
    res.json({ campaigns });
  } catch (err) {
    console.error('Fetch campaigns error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch campaigns.' });
  }
});

aiRoasteryRouter.post('/campaigns', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const {
      name,
      campaignType,
      targetSegment,
      channel,
      discountPercent,
      customTemplate,
      triggerMode,
    } = req.body;

    const result = await createWinbackCampaign({
      cafeId,
      name,
      campaignType,
      targetSegment,
      channel,
      discountPercent: Number(discountPercent) || 15,
      customTemplate,
      triggerMode,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ message: err.message || 'Failed to create campaign.' });
  }
});

aiRoasteryRouter.get('/campaigns/:id', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const campaign = await AiMarketingCampaign.findOne({
      where: { id: req.params.id, cafeId },
      include: [{
        model: AiCampaignRecipient,
        as: 'recipients',
      }],
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }

    res.json({ campaign });
  } catch (err) {
    console.error('Get campaign error:', err);
    res.status(500).json({ message: err.message || 'Failed to get campaign.' });
  }
});

aiRoasteryRouter.post('/campaigns/:id/send', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const cafeId = req.auth.cafe;
    const campaign = await AiMarketingCampaign.findOne({
      where: { id: req.params.id, cafeId },
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }

    const result = await launchCampaignBroadcast({ campaignId: campaign.id });
    res.json(result);
  } catch (err) {
    console.error('Broadcast campaign error:', err);
    res.status(500).json({ message: err.message || 'Failed to launch campaign broadcast.' });
  }
});
