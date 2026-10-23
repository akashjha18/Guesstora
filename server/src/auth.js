import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { RefreshToken, User } from './models.js';

export const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
export const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
export const REFRESH_TOKEN_EXPIRY_DAYS = Number.parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '30', 10);

export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id || user.sub,
      cafe: user.cafeId !== undefined ? user.cafeId : user.cafe,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    jwtSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

// Backward-compatible alias for existing callers
export function sign(user) {
  return generateAccessToken(user);
}

export const signToken = generateAccessToken;

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function generateRefreshToken(user, meta = {}) {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const family = meta.family || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    tokenHash,
    userId: user.id,
    cafeId: user.cafeId || null,
    family,
    expiresAt,
    userAgent: meta.userAgent || null,
    ipAddress: meta.ipAddress || null,
    isRevoked: false,
  });

  return {
    refreshToken: rawToken,
    expiresAt,
    family,
  };
}

export async function rotateRefreshToken(rawToken, meta = {}) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { error: 'invalid_token', message: 'Refresh token is required.' };
  }

  const tokenHash = hashToken(rawToken);
  const tokenRecord = await RefreshToken.findOne({ where: { tokenHash } });

  if (!tokenRecord) {
    return { error: 'token_not_found', message: 'Invalid or unknown refresh token.' };
  }

  // AUTOMATED REUSE DETECTION:
  // If an already revoked token is used, it indicates a replay attack or token theft!
  // Invalidate the ENTIRE token family immediately.
  if (tokenRecord.isRevoked) {
    await RefreshToken.update(
      { isRevoked: true },
      { where: { family: tokenRecord.family } }
    );
    return {
      error: 'token_reused',
      message: 'Compromised token family detected. All related sessions have been revoked for your security. Please sign in again.',
    };
  }

  // Check expiration
  if (new Date(tokenRecord.expiresAt) <= new Date()) {
    await tokenRecord.update({ isRevoked: true });
    return { error: 'token_expired', message: 'Refresh token has expired. Please sign in again.' };
  }

  // Verify active user
  const user = await User.findByPk(tokenRecord.userId);
  if (!user || user.isActive === false) {
    await tokenRecord.update({ isRevoked: true });
    return { error: 'user_inactive', message: 'User account not found or has been disabled.' };
  }

  // Mark current token as rotated/revoked
  await tokenRecord.update({ isRevoked: true });

  // Issue new refresh token within the SAME token family
  const newRefresh = await generateRefreshToken(user, {
    family: tokenRecord.family,
    userAgent: meta.userAgent || tokenRecord.userAgent,
    ipAddress: meta.ipAddress || tokenRecord.ipAddress,
  });

  // Issue new short-lived access token
  const newAccessToken = generateAccessToken(user);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefresh.refreshToken,
    expiresAt: newRefresh.expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      cafeId: user.cafeId,
    },
  };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return false;
  const tokenHash = hashToken(rawToken);
  const [affected] = await RefreshToken.update(
    { isRevoked: true },
    { where: { tokenHash, isRevoked: false } }
  );
  return affected > 0;
}

export async function revokeAllUserTokens(userId) {
  if (!userId) return 0;
  const [affected] = await RefreshToken.update(
    { isRevoked: true },
    { where: { userId, isRevoked: false } }
  );
  return affected;
}

export async function getActiveSessions(userId) {
  if (!userId) return [];
  return await RefreshToken.findAll({
    where: {
      userId,
      isRevoked: false,
      expiresAt: { [Op.gt]: new Date() },
    },
    attributes: ['id', 'family', 'createdAt', 'expiresAt', 'userAgent', 'ipAddress'],
    order: [['createdAt', 'DESC']],
  });
}

export const STAFF_ROLES = ['owner', 'manager', 'cashier', 'kitchen'];

export function requireStaff(req, res, next) {
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.query?.token ? String(req.query.token).trim() : '');

  if (!token) {
    return res.status(401).json({ message: 'Please sign in again.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (!STAFF_ROLES.includes(decoded.role)) {
      return res.status(403).json({ message: 'Staff or owner access required.' });
    }

    req.auth = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ 
      message: err.name === 'TokenExpiredError' ? 'Token expired. Please refresh session.' : 'Please sign in again.',
      code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        message: `Access denied. Role '${req.auth?.role || 'unknown'}' lacks permission for this action. Allowed: ${allowedRoles.join(', ')}.`,
      });
    }
    return next();
  };
}

export function requireOwner(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ message: 'Please sign in again.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded.role !== 'owner') {
      return res.status(403).json({ message: 'Owner access required.' });
    }

    req.auth = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ 
      message: err.name === 'TokenExpiredError' ? 'Token expired. Please refresh session.' : 'Please sign in again.',
      code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
}

