// 複数ユーザー対応の認証。ユーザー情報はデータストアに保存する。
// 初回起動時、ユーザーが0人なら環境変数から最初の管理者を作成する（ブートストラップ）。
//   ADMIN_USERNAME  最初の管理者ユーザー名（デフォルト admin）
//   ADMIN_PASSWORD  最初の管理者パスワード（未設定時はデフォルト + 警告）
import bcrypt from "bcryptjs";
import * as store from "./store.js";

const BOOTSTRAP_USERNAME = process.env.ADMIN_USERNAME || "admin";
const DEFAULT_PASSWORD = "changeme123";

let bootstrappedWithDefault = false;

export function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), 10);
}

// 起動時に最初の管理者を用意する
export async function bootstrap() {
  const count = await store.countUsers();
  if (count > 0) return;

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = DEFAULT_PASSWORD;
    bootstrappedWithDefault = true;
  }
  await store.createUser({
    username: BOOTSTRAP_USERNAME,
    name: BOOTSTRAP_USERNAME,
    passwordHash: hashPassword(password),
    role: "admin",
  });
  console.log(`[auth] 初期管理者ユーザー "${BOOTSTRAP_USERNAME}" を作成しました。`);
}

// ユーザー名・パスワードを検証してユーザーを返す（失敗時 null）
export async function authenticate(username, password) {
  const user = await store.getUserByUsername(username);
  if (!user) return null;
  let ok = false;
  try {
    ok = bcrypt.compareSync(String(password || ""), user.passwordHash);
  } catch {
    ok = false;
  }
  return ok ? user : null;
}

// セッションに保存する最小限のユーザー情報
export function sessionUser(user) {
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

// ログイン必須
export function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/admin/login");
}

// 管理者ロール必須（ユーザー管理など）
export function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "admin") return next();
  return res.status(403).render("error", {
    title: "権限がありません",
    code: 403,
    message: "この操作には管理者権限が必要です。",
  });
}

export function isUsingDefaultPassword() {
  return bootstrappedWithDefault;
}

export function warnIfInsecure() {
  if (bootstrappedWithDefault) {
    console.warn(
      "[security] ADMIN_PASSWORD が未設定のため初期パスワードで管理者を作成しました。" +
        " ログイン後に必ずパスワードを変更してください。"
    );
  }
  if (!process.env.SESSION_SECRET) {
    console.warn(
      "[security] SESSION_SECRET が未設定です。再起動でログインセッションが無効になります。"
    );
  }
}
