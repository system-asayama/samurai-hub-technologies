// シンプルなJSONファイル永続化ストア（native依存なしでCIが安定）
// データは DATA_DIR (デフォルト /data) 配下の data.json に保存される。
// 本番では /data をホストのボリュームにマウントして永続化すること。
import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "data.json");

const EMPTY = { users: [], posts: [], works: [] };

let cache = null;
let writeChain = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function load() {
  if (cache) return cache;
  await ensureDir();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    cache = { users: [], posts: [], works: [], ...parsed };
  } catch (err) {
    if (err.code === "ENOENT") {
      cache = structuredClone(EMPTY);
      await persist();
    } else {
      throw err;
    }
  }
  return cache;
}

// 直列化してアトミックに書き込む（同時書き込みでの破損を防ぐ）
function persist() {
  writeChain = writeChain.then(async () => {
    await ensureDir();
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cache, null, 2), "utf8");
    await fs.rename(tmp, DATA_FILE);
  });
  return writeChain;
}

// ---- ユーティリティ ----
let counter = 0;
export function genId() {
  // 時刻 + カウンタ + 乱数で衝突しないIDを生成
  counter = (counter + 1) % 100000;
  const rnd = Math.floor(Math.random() * 1e6).toString(36);
  return `${Date.now().toString(36)}${counter.toString(36)}${rnd}`;
}

export function slugify(input, fallback) {
  const base = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w぀-ヿ一-鿿-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || fallback || genId();
}

// ---- Users (管理ユーザー) ----
export async function listUsers() {
  const db = await load();
  return [...db.users].sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
}

export async function countUsers() {
  const db = await load();
  return db.users.length;
}

export async function getUserByUsername(username) {
  const db = await load();
  const key = String(username || "").trim().toLowerCase();
  return db.users.find((u) => u.username.toLowerCase() === key) || null;
}

export async function getUserById(id) {
  const db = await load();
  return db.users.find((u) => u.id === id) || null;
}

export async function createUser({ username, name, passwordHash, role }) {
  const db = await load();
  const user = {
    id: genId(),
    username: String(username).trim(),
    name: name || username,
    passwordHash,
    role: role === "admin" ? "admin" : "editor",
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await persist();
  return user;
}

export async function updateUser(id, data) {
  const db = await load();
  const user = db.users.find((u) => u.id === id);
  if (!user) return null;
  if (data.name !== undefined) user.name = data.name;
  if (data.role !== undefined) user.role = data.role === "admin" ? "admin" : "editor";
  if (data.passwordHash) user.passwordHash = data.passwordHash;
  await persist();
  return user;
}

export async function deleteUser(id) {
  const db = await load();
  const i = db.users.findIndex((u) => u.id === id);
  if (i === -1) return false;
  db.users.splice(i, 1);
  await persist();
  return true;
}

export async function countAdmins() {
  const db = await load();
  return db.users.filter((u) => u.role === "admin").length;
}

// ---- Posts (ブログ) ----
export async function listPosts({ publishedOnly = false } = {}) {
  const db = await load();
  let items = [...db.posts];
  if (publishedOnly) items = items.filter((p) => p.published);
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPostBySlug(slug) {
  const db = await load();
  return db.posts.find((p) => p.slug === slug) || null;
}

export async function getPostById(id) {
  const db = await load();
  return db.posts.find((p) => p.id === id) || null;
}

export async function createPost(data) {
  const db = await load();
  const now = new Date().toISOString();
  const post = {
    id: genId(),
    slug: await uniqueSlug(db.posts, data.slug || data.title),
    title: data.title || "(無題)",
    excerpt: data.excerpt || "",
    body: data.body || "",
    coverImage: data.coverImage || "",
    author: data.author || "",
    published: Boolean(data.published),
    createdAt: now,
    updatedAt: now,
  };
  db.posts.push(post);
  await persist();
  return post;
}

export async function updatePost(id, data) {
  const db = await load();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return null;
  if (data.slug && data.slug !== post.slug) {
    post.slug = await uniqueSlug(db.posts, data.slug, id);
  }
  if (data.title !== undefined) post.title = data.title;
  if (data.excerpt !== undefined) post.excerpt = data.excerpt;
  if (data.body !== undefined) post.body = data.body;
  if (data.coverImage !== undefined) post.coverImage = data.coverImage;
  if (data.published !== undefined) post.published = Boolean(data.published);
  post.updatedAt = new Date().toISOString();
  await persist();
  return post;
}

export async function deletePost(id) {
  const db = await load();
  const i = db.posts.findIndex((p) => p.id === id);
  if (i === -1) return false;
  db.posts.splice(i, 1);
  await persist();
  return true;
}

// ---- Works (実績) ----
export async function listWorks({ publishedOnly = false } = {}) {
  const db = await load();
  let items = [...db.works];
  if (publishedOnly) items = items.filter((w) => w.published);
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getWorkBySlug(slug) {
  const db = await load();
  return db.works.find((w) => w.slug === slug) || null;
}

export async function getWorkById(id) {
  const db = await load();
  return db.works.find((w) => w.id === id) || null;
}

export async function createWork(data) {
  const db = await load();
  const now = new Date().toISOString();
  const work = {
    id: genId(),
    slug: await uniqueSlug(db.works, data.slug || data.title),
    title: data.title || "(無題)",
    summary: data.summary || "",
    body: data.body || "",
    coverImage: data.coverImage || "",
    url: data.url || "",
    tags: normalizeTags(data.tags),
    author: data.author || "",
    published: Boolean(data.published),
    createdAt: now,
    updatedAt: now,
  };
  db.works.push(work);
  await persist();
  return work;
}

export async function updateWork(id, data) {
  const db = await load();
  const work = db.works.find((w) => w.id === id);
  if (!work) return null;
  if (data.slug && data.slug !== work.slug) {
    work.slug = await uniqueSlug(db.works, data.slug, id);
  }
  if (data.title !== undefined) work.title = data.title;
  if (data.summary !== undefined) work.summary = data.summary;
  if (data.body !== undefined) work.body = data.body;
  if (data.coverImage !== undefined) work.coverImage = data.coverImage;
  if (data.url !== undefined) work.url = data.url;
  if (data.tags !== undefined) work.tags = normalizeTags(data.tags);
  if (data.published !== undefined) work.published = Boolean(data.published);
  work.updatedAt = new Date().toISOString();
  await persist();
  return work;
}

export async function deleteWork(id) {
  const db = await load();
  const i = db.works.findIndex((w) => w.id === id);
  if (i === -1) return false;
  db.works.splice(i, 1);
  await persist();
  return true;
}

// ---- helpers ----
function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

async function uniqueSlug(items, source, ignoreId) {
  const base = slugify(source);
  let slug = base;
  let n = 2;
  while (items.some((it) => it.slug === slug && it.id !== ignoreId)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}
