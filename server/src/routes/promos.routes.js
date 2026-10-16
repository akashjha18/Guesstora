import { Router } from 'express';
import { Cafe, PromoCode } from '../models.js';
import { requireRole } from '../auth.js';
import { calculateDiscount } from '../shifts.js';
import { serializePromoCode } from './serializers.js';

const router = Router();

// GET /owner/promo-codes - List all promo codes for the cafe
router.get('/owner/promo-codes', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const codes = await PromoCode.findAll({
      where: { cafeId: req.auth.cafe },
      order: [['createdAt', 'DESC']],
    });
    return res.json(codes.map(serializePromoCode));
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch promo codes.' });
  }
});

// POST /owner/promo-codes - Create promo code
router.post('/owner/promo-codes', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ message: 'Promo code string is required.' });
    }

    const existing = await PromoCode.findOne({
      where: { cafeId: req.auth.cafe, code }
    });
    if (existing) {
      return res.status(400).json({ message: `Promo code "${code}" already exists.` });
    }

    const promo = await PromoCode.create({
      cafeId: req.auth.cafe,
      code,
      discountType: req.body.discountType === 'flat' ? 'flat' : 'percent',
      discountValue: Math.max(0, Number(req.body.discountValue) || 0),
      maxDiscountAmount: req.body.maxDiscountAmount ? Number(req.body.maxDiscountAmount) : null,
      minOrderAmount: Math.max(0, Number(req.body.minOrderAmount) || 0),
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      usageLimit: req.body.usageLimit ? parseInt(req.body.usageLimit, 10) : null,
      isActive: req.body.isActive !== false,
      description: req.body.description ? String(req.body.description).trim() : '',
    });

    return res.status(201).json(serializePromoCode(promo));
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to create promo code.' });
  }
});

// PATCH /owner/promo-codes/:id - Update / toggle promo code
router.patch('/owner/promo-codes/:id', requireRole('owner', 'manager'), async (req, res) => {
  try {
    const promo = await PromoCode.findOne({
      where: { id: req.params.id, cafeId: req.auth.cafe }
    });
    if (!promo) return res.status(404).json({ message: 'Promo code not found.' });

    if (req.body.isActive !== undefined) promo.isActive = Boolean(req.body.isActive);
    if (req.body.discountValue !== undefined) promo.discountValue = Number(req.body.discountValue) || 0;
    if (req.body.description !== undefined) promo.description = String(req.body.description).trim();
    if (req.body.minOrderAmount !== undefined) promo.minOrderAmount = Number(req.body.minOrderAmount) || 0;
    if (req.body.maxDiscountAmount !== undefined) promo.maxDiscountAmount = req.body.maxDiscountAmount ? Number(req.body.maxDiscountAmount) : null;
    await promo.save();

    return res.json(serializePromoCode(promo));
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to update promo code.' });
  }
});

// POST /public/cafes/:slug/promo-codes/validate - Validate promo code for online diner checkout
router.post('/public/cafes/:slug/promo-codes/validate', async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ valid: false, message: 'Enter a promo code.' });

    const cafe = await Cafe.findOne({ where: { slug: req.params.slug } });
    if (!cafe) return res.status(404).json({ valid: false, message: 'Cafe not found.' });

    const promo = await PromoCode.findOne({
      where: {
        cafeId: cafe.id,
        code: String(code).trim().toUpperCase(),
        isActive: true,
      }
    });

    if (!promo) {
      return res.status(404).json({ valid: false, message: 'Invalid promo code.' });
    }

    const now = new Date();
    if (promo.startDate && new Date(promo.startDate) > now) {
      return res.status(400).json({ valid: false, message: 'Promo code is not active yet.' });
    }
    if (promo.endDate && new Date(promo.endDate) < now) {
      return res.status(400).json({ valid: false, message: 'Promo code has expired.' });
    }
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
      return res.status(400).json({ valid: false, message: 'Promo code usage limit has been reached.' });
    }

    const calc = calculateDiscount(
      Number(subtotal) || 0,
      promo.discountType,
      promo.discountValue,
      promo.maxDiscountAmount,
      promo.minOrderAmount
    );

    if (!calc.valid) {
      return res.status(400).json({ valid: false, message: calc.reason });
    }

    return res.json({
      valid: true,
      code: promo.code,
      discountAmount: calc.discountAmount,
      finalTotal: Math.max(0, (Number(subtotal) || 0) - calc.discountAmount),
      promo: serializePromoCode(promo),
    });
  } catch (err) {
    return res.status(500).json({ valid: false, message: err.message || 'Validation failed.' });
  }
});

export default router;
