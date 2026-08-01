// Pure helpers, no DOM access (see REFACTOR_PLAN.md, Phase 2).

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
    (_, label, id) => `<span class="keyword" data-keyword="${id}">${label}</span>`
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
