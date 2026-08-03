// Pure helpers, no DOM access.

// UTF-8-safe base64 (btoa/atob are Latin1-only; save_state.js and replay.js
// both encode JSON payloads that can contain emoji).
export const toBase64Utf8 = (str) => btoa(unescape(encodeURIComponent(str)));
export const fromBase64Utf8 = (base64) =>
  decodeURIComponent(escape(atob(base64)));

// Fitzpatrick skin-tone modifiers. Santa is the only symbol whose static
// emoji ever carried one; stripping it (and folding the classic 🎅 glyph
// onto the canonical 🧑‍🎄) lets any tone resolve to the one catalog key.
const SKIN_TONE_RE = /[\u{1F3FB}-\u{1F3FF}]/gu;
export const normalizeSkinTone = (emoji) => {
  const stripped = emoji.replace(SKIN_TONE_RE, '');
  return stripped === '🎅' ? '🧑‍🎄' : stripped;
};

export const parseEmojiString = (str) => {
  const seg = new Intl.Segmenter('en', {
    granularity: 'grapheme',
  });
  const graphemeSegments = seg.segment(str);
  return Array.from(graphemeSegments).map((x) => x.segment);
};

const KEYWORD_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export const createInteractiveDescription = (description, emoji = null) => {
  // Keywords: [Display](id) -> underlined, clickable span. Run before the
  // emoji pass below so the injected span's plain-text label still gets
  // segmented and any emoji inside it wrapped normally.
  const withKeywords = description.replace(
    KEYWORD_RE,
    (_, label, id) =>
      `<span class="keyword" data-keyword="${id}">${label}</span>`
  );
  const segments = parseEmojiString(withKeywords);
  let result = '';
  if (emoji) {
    result = `${emoji}: `;
  }
  for (const segment of segments) {
    if (segment.match(/\p{Emoji}/u) && !segment.match(/^\d+$/)) {
      result += `<span class="interactive-emoji" data-emoji="${segment}">${segment}</span>`;
    } else {
      result += segment;
    }
  }
  return result;
};

export const formatBigNumber = (n) => {
  if (n === '') {
    return '';
  }
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const truncFixed = (value, decimals) => {
    const p = 10 ** decimals;
    return (Math.trunc(value * p) / p).toFixed(decimals);
  };
  if (abs < 100_000) return sign + abs;
  if (abs < 1_000_000) return sign + Math.trunc(abs / 1_000) + 'K';
  if (abs < 10_000_000) return sign + truncFixed(abs / 1_000_000, 2) + 'M';
  if (abs < 100_000_000) return sign + truncFixed(abs / 1_000_000, 1) + 'M';
  if (abs < 1_000_000_000) return sign + Math.trunc(abs / 1_000_000) + 'M';
  if (abs < 10_000_000_000)
    return sign + truncFixed(abs / 1_000_000_000, 2) + 'B';
  if (abs < 100_000_000_000)
    return sign + truncFixed(abs / 1_000_000_000, 1) + 'B';
  if (abs < 1_000_000_000_000)
    return sign + Math.trunc(abs / 1_000_000_000) + 'B';
  if (abs < 10_000_000_000_000)
    return sign + truncFixed(abs / 1_000_000_000_000, 2) + 'T';
  if (abs < 100_000_000_000_000)
    return sign + truncFixed(abs / 1_000_000_000_000, 1) + 'T';
  if (abs < 1_000_000_000_000_000)
    return sign + Math.trunc(abs / 1_000_000_000_000) + 'T';
  return sign + truncFixed(abs / 1_000_000_000_000_000, 2) + 'Q';
};
