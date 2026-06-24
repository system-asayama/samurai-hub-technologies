// Markdown → HTML 変換。コンテンツは管理者のみが書くため最小限の構成。
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(src) {
  if (!src) return "";
  return marked.parse(String(src));
}

// 一覧などで使う、HTMLタグを除いた抜粋テキスト
export function toPlainExcerpt(src, length = 120) {
  const text = String(src || "")
    .replace(/[#>*`_~\-]/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= length) return text;
  return text.slice(0, length) + "…";
}
