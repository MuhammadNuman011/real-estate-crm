const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Config = require("../config/config");
const db = require("../config/db");
const RefreshTokens = require("../modals/RefreshToken");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signRefreshToken(role, subjectId, jti) {
  return jwt.sign(
    {
      type: "refresh",
      role: role,
      sub: subjectId,
      jti: jti
    },
    Config.jwtSecret,
    { expiresIn: Config.refreshExpiresIn }
  );
}

function readRefreshPayload(rawToken, expectedRole, ignoreExpiration) {
  if (typeof rawToken !== "string" || !rawToken.trim()) {
    return { ok: false, status: 401, error: "Invalid or missing refresh token." };
  }

  let payload;
  try {
    payload = jwt.verify(rawToken, Config.jwtSecret, {
      ignoreExpiration: Boolean(ignoreExpiration)
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return { ok: false, status: 401, error: "Session expired. Please log in again." };
    }
    return { ok: false, status: 401, error: "Invalid or missing refresh token." };
  }

  if (!payload || payload.type !== "refresh" || payload.role !== expectedRole || !payload.jti || payload.sub == null) {
    return { ok: false, status: 401, error: "Invalid or missing refresh token." };
  }

  return { ok: true, jti: payload.jti, sub: payload.sub };
}

async function issueRefreshToken(role, subjectId) {
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken(role, subjectId, jti);
  const decoded = jwt.decode(refreshToken);
  await RefreshTokens.create({
    jti: jti,
    role: role,
    subject_id: subjectId,
    token_hash: hashToken(refreshToken),
    expires_at: new Date(decoded.exp * 1000)
  });
  return refreshToken;
}

async function beginRefresh(rawToken, expectedRole) {
  const parsed = readRefreshPayload(rawToken, expectedRole, false);
  if (!parsed.ok) return parsed;

  const transaction = await db.transaction();
  let settled = false;

  async function abort() {
    if (settled) return;
    settled = true;
    await transaction.rollback();
  }

  try {
    const row = await RefreshTokens.findOne({
      where: { jti: parsed.jti },
      transaction: transaction,
      lock: transaction.LOCK.UPDATE
    });

    const hashMatches = row && row.token_hash === hashToken(rawToken);
    const subjectMatches = row && String(row.subject_id) === String(parsed.sub) && row.role === expectedRole;
    if (!row || !hashMatches || !subjectMatches) {
      await abort();
      return { ok: false, status: 401, error: "Invalid or missing refresh token." };
    }

    if (row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
      await abort();
      return { ok: false, status: 401, error: "Session expired. Please log in again." };
    }

    return {
      ok: true,
      subjectId: row.subject_id,
      abort: abort,
      finish: async function() {
        if (settled) {
          throw new Error("Refresh transaction already settled.");
        }
        const jti = crypto.randomUUID();
        const refreshToken = signRefreshToken(expectedRole, row.subject_id, jti);
        const decoded = jwt.decode(refreshToken);
        row.revoked_at = new Date();
        row.replaced_by = jti;
        await row.save({ transaction: transaction });
        await RefreshTokens.create({
          jti: jti,
          role: expectedRole,
          subject_id: row.subject_id,
          token_hash: hashToken(refreshToken),
          expires_at: new Date(decoded.exp * 1000)
        }, { transaction: transaction });
        await transaction.commit();
        settled = true;
        return refreshToken;
      }
    };
  } catch (error) {
    await abort();
    throw error;
  }
}

async function revokeRefreshToken(rawToken, expectedRole) {
  const parsed = readRefreshPayload(rawToken, expectedRole, true);
  if (!parsed.ok) return false;

  const row = await RefreshTokens.findOne({ where: { jti: parsed.jti } });
  if (!row || row.role !== expectedRole || String(row.subject_id) !== String(parsed.sub)) {
    return false;
  }
  if (row.token_hash !== hashToken(rawToken)) return false;
  if (!row.revoked_at) {
    row.revoked_at = new Date();
    await row.save();
  }
  return true;
}

module.exports = {
  issueRefreshToken,
  beginRefresh,
  revokeRefreshToken
};
