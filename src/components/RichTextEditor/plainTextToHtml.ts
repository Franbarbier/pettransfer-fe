function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function plainTextToHtml(text: string): string {
  if (!text) return "";
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const lines = para.split("\n").map(escapeHtml);
      const inner = lines.join("<br>");
      return inner ? `<p>${inner}</p>` : "";
    })
    .filter(Boolean)
    .join("");
}
