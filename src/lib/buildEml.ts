export type EmlParams = {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachmentBase64: string;
  attachmentFilename: string;
  date?: Date;
};

function formatRfc2822Date(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const absOff = Math.abs(off);
  return `${days[date.getDay()]}, ${pad(date.getDate())} ${months[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${sign}${pad(Math.floor(absOff / 60))}${pad(absOff % 60)}`;
}

// RFC 2047 encoded-word for non-ASCII subjects
function encodeRfc2047(str: string): string {
  if (/^[\x20-\x7E]*$/.test(str)) return str;
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function stringToBase64(str: string): string {
  return uint8ToBase64(new TextEncoder().encode(str));
}

// RFC 2045: base64 body lines max 76 chars
function wrapLines(b64: string): string {
  const clean = b64.replace(/\s/g, "");
  return clean.match(/.{1,76}/g)?.join("\r\n") ?? clean;
}

// Returns the .eml content already base64-encoded, ready to pass to the Dropbox upload endpoint
export function buildEmlBase64(params: EmlParams): string {
  const { from, to, cc, subject, body, attachmentBase64, attachmentFilename, date = new Date() } = params;
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@latampettransport.com>`;

  const content = [
    "MIME-Version: 1.0",
    `Date: ${formatRfc2822Date(date)}`,
    `From: ${from}`,
    `To: ${to}`,
    ...(cc?.trim() ? [`CC: ${cc.trim()}`] : []),
    `Subject: ${encodeRfc2047(subject)}`,
    `Message-ID: ${messageId}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapLines(stringToBase64(body)),
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${attachmentFilename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachmentFilename}"`,
    "",
    wrapLines(attachmentBase64),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return stringToBase64(content);
}
