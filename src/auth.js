// 単一管理者の認証。認証情報は環境変数から読み込む。
//   ADMIN_USERNAME      管理者ユーザー名（デフォルト admin）
//   ADMIN_PASSWORD      管理者パスワード（平文。未設定時はデフォルトを使い警告）
//   ADMIN_PASSWORD_HASH bcryptハッシュ（指定時は ADMIN_PASSWORD より優先）
import bcrypt from "bcryptjs";

const USERNAME = process.env.ADMIN_USERNAME || "admin";
const DEFAULT_PASSWORD = "changeme123";

let passwordHash;
let usingDefaultPassword = false;

if (process.env.ADMIN_PASSWORD_HASH) {
  passwordHash = process.env.ADMIN_PASSWORD_HASH;
} else if (process.env.ADMIN_PASSWORD) {
  passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
} else {
  passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  usingDefaultPassword = true;
}

export const isUsingDefaultPassword = usingDefaultPassword;
export const adminUsername = USERNAME;

export function verifyCredentials(username, password) {
  if (username !== USERNAME) return false;
  try {
    return bcrypt.compareSync(String(password || ""), passwordHash);
  } catch {
    return false;
  }
}

// ログイン必須ルートを保護するミドルウェア
export function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/admin/login");
}

export function warnIfInsecure() {
  if (usingDefaultPassword) {
    console.warn(
      "[security] ADMIN_PASSWORD が未設定です。デフォルトの初期パスワードで稼働中。" +
        " 本番では必ず ADMIN_PASSWORD（または ADMIN_PASSWORD_HASH）を設定してください。"
    );
  }
  if (!process.env.SESSION_SECRET) {
    console.warn(
      "[security] SESSION_SECRET が未設定です。再起動でログインセッションが無効になります。"
    );
  }
}
