export function generateClaimCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CLM-${code}`;
}

export function calculateRewardProgress(visits, required) {
  const safeRequired = Math.max(2, Number(required) || 8);
  return { visits: visits % safeRequired, required: safeRequired, remaining: safeRequired - (visits % safeRequired) };
}

// order, customer, cafe are Sequelize model instances.
export async function processLoyalty({ order, customer, cafe }) {
  if (order.loyaltyProcessed || order.status !== 'completed' || order.paymentStatus !== 'paid') return null;
  order.loyaltyProcessed = true;
  if (!cafe.loyaltyEnabled || order.subtotal < cafe.loyaltyMinimumSpend) { await order.save(); return null; }
  customer.visits += 1;
  let reward = null;
  if (customer.visits % cafe.loyaltyVisitsRequired === 0) {
    reward = await customer.createReward({
      amount: cafe.loyaltyRewardCap,
      claimCode: generateClaimCode(),
      status: 'available',
      expiresAt: new Date(Date.now() + cafe.loyaltyValidityDays * 86400000),
      cafeId: cafe.id,
    });
  }
  await Promise.all([customer.save(), order.save()]);
  return reward;
}
