import { AuditLog } from './models.js';

export function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const xForwarded = req.headers?.['x-forwarded-for'];
  if (xForwarded) {
    return String(xForwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

export function getClientUserAgent(req) {
  if (!req) return 'System / Node';
  return String(req.headers?.['user-agent'] || 'Unknown Client').slice(0, 255);
}

export async function createAuditLog({
  cafeId = null,
  userId = null,
  userName = 'System',
  userRole = 'system',
  action,
  category = 'auth',
  details = {},
  status = 'success',
  req = null,
}) {
  try {
    const ipAddress = getClientIp(req);
    const userAgent = getClientUserAgent(req);

    let finalUserId = userId;
    let finalUserName = userName;
    let finalUserRole = userRole;
    let finalCafeId = cafeId;

    if (req?.auth) {
      finalUserId = finalUserId || req.auth.sub || req.auth.id;
      finalUserName = finalUserName === 'System' ? (req.auth.name || req.auth.email || 'Staff') : finalUserName;
      finalUserRole = finalUserRole === 'system' ? (req.auth.role || 'staff') : finalUserRole;
      finalCafeId = finalCafeId || req.auth.cafe;
    }

    return await AuditLog.create({
      cafeId: finalCafeId,
      userId: finalUserId,
      userName: finalUserName,
      userRole: finalUserRole,
      action,
      category,
      details,
      status,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    console.error('AuditLog creation warning:', err.message);
    return null;
  }
}
