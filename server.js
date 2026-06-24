import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

import * as store from "./src/store.js";
import { renderMarkdown, toPlainExcerpt } from "./src/markdown.js";
import {
  authenticate,
  sessionUser,
  hashPassword,
  requireAuth,
  requireAdmin,
  warnIfInsecure,
  isUsingDefaultPassword,
  bootstrap,
} from "./src/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8084;
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7日
    },
  })
);

// 静的アセット（CSS/JS/画像）
app.use("/assets", express.static(path.join(__dirname, "public")));

// テンプレート共通のローカル変数
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.path = req.path;
  res.locals.year = new Date().getFullYear();
  next();
});

// ---------- 公開ページ ----------
app.get("/", async (req, res, next) => {
  try {
    const [posts, works] = await Promise.all([
      store.listPosts({ publishedOnly: true }),
      store.listWorks({ publishedOnly: true }),
    ]);
    res.render("home", {
      title: "Samurai Hub Technologies｜システム開発・Web制作の個人事業主",
      latestPosts: posts.slice(0, 3),
      latestWorks: works.slice(0, 3),
      toPlainExcerpt,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/blog", async (req, res, next) => {
  try {
    const posts = await store.listPosts({ publishedOnly: true });
    res.render("blog-list", { title: "ブログ｜Samurai Hub Technologies", posts, toPlainExcerpt });
  } catch (err) {
    next(err);
  }
});

app.get("/blog/:slug", async (req, res, next) => {
  try {
    const post = await store.getPostBySlug(req.params.slug);
    if (!post || !post.published) return next();
    res.render("blog-post", {
      title: `${post.title}｜ブログ`,
      post,
      bodyHtml: renderMarkdown(post.body),
    });
  } catch (err) {
    next(err);
  }
});

app.get("/works", async (req, res, next) => {
  try {
    const works = await store.listWorks({ publishedOnly: true });
    res.render("works-list", { title: "実績｜Samurai Hub Technologies", works, toPlainExcerpt });
  } catch (err) {
    next(err);
  }
});

app.get("/works/:slug", async (req, res, next) => {
  try {
    const work = await store.getWorkBySlug(req.params.slug);
    if (!work || !work.published) return next();
    res.render("works-detail", {
      title: `${work.title}｜実績`,
      work,
      bodyHtml: renderMarkdown(work.body),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- 認証 ----------
app.get("/admin/login", (req, res) => {
  if (req.session.user) return res.redirect("/admin");
  res.render("admin/login", { title: "管理者ログイン", error: null, layout: false });
});

app.post("/admin/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await authenticate(username, password);
    if (user) {
      req.session.user = sessionUser(user);
      return res.redirect("/admin");
    }
    res.status(401).render("admin/login", {
      title: "管理者ログイン",
      error: "ユーザー名またはパスワードが正しくありません。",
      layout: false,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

// ---------- 管理画面（要ログイン） ----------
app.use("/admin", requireAuth);

app.get("/admin", async (req, res, next) => {
  try {
    const [posts, works] = await Promise.all([store.listPosts(), store.listWorks()]);
    res.render("admin/dashboard", {
      title: "管理ダッシュボード",
      posts,
      works,
      showPasswordWarning: isUsingDefaultPassword(),
    });
  } catch (err) {
    next(err);
  }
});

// --- ブログ管理 ---
app.get("/admin/posts/new", (req, res) => {
  res.render("admin/post-form", { title: "記事を新規作成", post: null, mode: "new" });
});

app.post("/admin/posts", async (req, res, next) => {
  try {
    await store.createPost({ ...formToPost(req.body), author: req.session.user.name });
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
});

app.get("/admin/posts/:id/edit", async (req, res, next) => {
  try {
    const post = await store.getPostById(req.params.id);
    if (!post) return next();
    res.render("admin/post-form", { title: "記事を編集", post, mode: "edit" });
  } catch (err) {
    next(err);
  }
});

app.post("/admin/posts/:id", async (req, res, next) => {
  try {
    const updated = await store.updatePost(req.params.id, formToPost(req.body));
    if (!updated) return next();
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
});

app.post("/admin/posts/:id/delete", async (req, res, next) => {
  try {
    await store.deletePost(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
});

// --- 実績管理 ---
app.get("/admin/works/new", (req, res) => {
  res.render("admin/work-form", { title: "実績を新規作成", work: null, mode: "new" });
});

app.post("/admin/works", async (req, res, next) => {
  try {
    await store.createWork({ ...formToWork(req.body), author: req.session.user.name });
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
});

app.get("/admin/works/:id/edit", async (req, res, next) => {
  try {
    const work = await store.getWorkById(req.params.id);
    if (!work) return next();
    res.render("admin/work-form", { title: "実績を編集", work, mode: "edit" });
  } catch (err) {
    next(err);
  }
});

app.post("/admin/works/:id", async (req, res, next) => {
  try {
    const updated = await store.updateWork(req.params.id, formToWork(req.body));
    if (!updated) return next();
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
});

app.post("/admin/works/:id/delete", async (req, res, next) => {
  try {
    await store.deleteWork(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    next(err);
  }
});

// ---------- ユーザー管理（管理者のみ） ----------
app.get("/admin/users", requireAdmin, async (req, res, next) => {
  try {
    const users = await store.listUsers();
    res.render("admin/users", { title: "ユーザー管理", users, notice: req.query.notice || null });
  } catch (err) {
    next(err);
  }
});

app.get("/admin/users/new", requireAdmin, (req, res) => {
  res.render("admin/user-form", { title: "ユーザーを追加", user: null, mode: "new", error: null });
});

app.post("/admin/users", requireAdmin, async (req, res, next) => {
  try {
    const { username, name, password, role } = req.body;
    const uname = (username || "").trim();
    if (!uname || !password) {
      return res.status(400).render("admin/user-form", {
        title: "ユーザーを追加",
        user: null,
        mode: "new",
        error: "ユーザー名とパスワードは必須です。",
      });
    }
    if (await store.getUserByUsername(uname)) {
      return res.status(409).render("admin/user-form", {
        title: "ユーザーを追加",
        user: null,
        mode: "new",
        error: "そのユーザー名は既に使われています。",
      });
    }
    await store.createUser({
      username: uname,
      name: (name || "").trim() || uname,
      passwordHash: hashPassword(password),
      role,
    });
    res.redirect("/admin/users?notice=created");
  } catch (err) {
    next(err);
  }
});

app.get("/admin/users/:id/edit", requireAdmin, async (req, res, next) => {
  try {
    const user = await store.getUserById(req.params.id);
    if (!user) return next();
    res.render("admin/user-form", { title: "ユーザーを編集", user, mode: "edit", error: null });
  } catch (err) {
    next(err);
  }
});

app.post("/admin/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const user = await store.getUserById(req.params.id);
    if (!user) return next();
    const { name, password, role } = req.body;
    const patch = { name: (name || "").trim() || user.username };

    // 管理者を自分自身から降格させて管理者が0人になるのを防ぐ
    let nextRole = role === "admin" ? "admin" : "editor";
    if (user.role === "admin" && nextRole !== "admin" && (await store.countAdmins()) <= 1) {
      nextRole = "admin";
    }
    patch.role = nextRole;
    if (password) patch.passwordHash = hashPassword(password);

    await store.updateUser(user.id, patch);

    // 自分自身を編集した場合はセッションの表示名・ロールも更新
    if (req.session.user.id === user.id) {
      req.session.user.name = patch.name;
      req.session.user.role = patch.role;
    }
    res.redirect("/admin/users?notice=updated");
  } catch (err) {
    next(err);
  }
});

app.post("/admin/users/:id/delete", requireAdmin, async (req, res, next) => {
  try {
    const user = await store.getUserById(req.params.id);
    if (!user) return next();
    // 自分自身・最後の管理者は削除不可
    if (req.session.user.id === user.id) {
      return res.redirect("/admin/users?notice=self");
    }
    if (user.role === "admin" && (await store.countAdmins()) <= 1) {
      return res.redirect("/admin/users?notice=lastadmin");
    }
    await store.deleteUser(user.id);
    res.redirect("/admin/users?notice=deleted");
  } catch (err) {
    next(err);
  }
});

// ---------- 404 / エラー ----------
app.use((req, res) => {
  res.status(404).render("error", { title: "ページが見つかりません", code: 404, message: "お探しのページは見つかりませんでした。" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", { title: "エラー", code: 500, message: "サーバーでエラーが発生しました。" });
});

// ---------- フォーム変換 ----------
function formToPost(body) {
  return {
    title: (body.title || "").trim(),
    slug: (body.slug || "").trim(),
    excerpt: (body.excerpt || "").trim(),
    body: body.body || "",
    coverImage: (body.coverImage || "").trim(),
    published: body.published === "on" || body.published === "true",
  };
}

function formToWork(body) {
  return {
    title: (body.title || "").trim(),
    slug: (body.slug || "").trim(),
    summary: (body.summary || "").trim(),
    body: body.body || "",
    coverImage: (body.coverImage || "").trim(),
    url: (body.url || "").trim(),
    tags: body.tags || "",
    published: body.published === "on" || body.published === "true",
  };
}

async function startServer() {
  await bootstrap();
  app.listen(PORT, "0.0.0.0", () => {
    warnIfInsecure();
    console.log(`Samurai Hub Technologies is running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("起動に失敗しました:", err);
  process.exit(1);
});
