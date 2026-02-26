import { MJElement, MJComponentType } from '../types';
import { MJML_COMPONENTS } from '../constants';

/** Head components — rendered inside <mj-head>, not <mj-body> */
const HEAD_TYPES = new Set<MJComponentType>([
  'mj-attributes',
  'mj-breakpoint',
  'mj-font',
  'mj-html-attributes',
  'mj-preview',
  'mj-style',
  'mj-title',
]);

/** Tags that are self-closing (no children or text content) */
const SELF_CLOSING = new Set<MJComponentType>([
  'mj-breakpoint',
  'mj-font',
  'mj-image',
  'mj-divider',
  'mj-spacer',
  'mj-carousel-image',
  'mj-html-attributes',
]);

// ── Font helpers ──────────────────────────────────────────────────────────────

/**
 * System / web-safe fonts that do NOT need a Google Fonts link.
 * Anything not in this list that appears in a font-family attribute will be
 * treated as a Google Font and an mj-font element will be auto-injected.
 */
const SYSTEM_FONTS = new Set([
  'arial', 'helvetica', 'helvetica neue', 'verdana', 'tahoma', 'trebuchet ms',
  'times new roman', 'georgia', 'garamond', 'courier new', 'courier',
  'palatino', 'book antiqua', 'impact', 'comic sans ms', 'lucida sans',
  'lucida grande', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
]);

/**
 * Google Fonts that are always included in the generated head, regardless of
 * whether any component explicitly references them. Acts as a reliable baseline
 * so the compiled HTML always has at least these <link> tags.
 */
const DEFAULT_GOOGLE_FONTS: { name: string; url: string }[] = [
  {
    name: 'Inter',
    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700&display=swap',
  },
];

/**
 * Collect every unique primary font name used in font-family attributes across
 * the entire element tree (body elements only).
 * "Primary" = the first comma-separated token with quotes and extra spaces trimmed.
 */
function collectFontsFromElements(elements: MJElement[]): Set<string> {
  const fonts = new Set<string>();

  const walk = (els: MJElement[]) => {
    for (const el of els) {
      const ff = el.attributes['font-family'];
      if (ff) {
        // Take the first token before any comma — that's the intent font
        const primary = ff.split(',')[0].trim().replace(/^["']|["']$/g, '');
        if (primary) fonts.add(primary);
      }
      if (el.children) walk(el.children);
    }
  };

  walk(elements);
  return fonts;
}

/**
 * Build a Google Fonts URL for a given font family name.
 * Requests weights 300,400,500,700 for broad coverage.
 * e.g. "Open Sans" → https://fonts.googleapis.com/css?family=Open+Sans:300,400,500,700
 */
function googleFontsUrl(fontName: string): string {
  const encoded = fontName.trim().replace(/ /g, '+');
  return `https://fonts.googleapis.com/css?family=${encoded}:300,400,500,700`;
}

/**
 * Given the manual mj-font elements the user has placed, return the set of
 * font *names* already declared so we don't emit duplicates.
 */
function declaredFontNames(fontEls: MJElement[]): Set<string> {
  const names = new Set<string>();
  for (const el of fontEls) {
    const n = el.attributes['name'];
    if (n) names.add(n.trim().toLowerCase());
  }
  return names;
}

// ── MJML serialiser ───────────────────────────────────────────────────────────

export const generateMJML = (elements: MJElement[]): string => {
  // Strip hidden elements from both head and body before any processing
  const stripHidden = (els: MJElement[]): MJElement[] =>
    els
      .filter(el => !el.hidden)
      .map(el => el.children ? { ...el, children: stripHidden(el.children) } : el);

  const visible = stripHidden(elements);
  const headEls = visible.filter(el => HEAD_TYPES.has(el.type));
  const bodyEls = visible.filter(el => !HEAD_TYPES.has(el.type));

  const renderEl = (el: MJElement, indent = '    '): string => {
    // Merge defaultAttrs so attributes added to constants after a template was
    // saved are still emitted. Live values in el.attributes always win.
    const componentDef = MJML_COMPONENTS.find(c => c.type === el.type);
    const mergedAttributes: Record<string, string> = {
      ...(componentDef?.defaultAttrs ?? {}),
      ...el.attributes,
    };

    const attrs = Object.entries(mergedAttributes)
      .filter(([, v]) => v !== '')          // skip optional fields left blank
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');

    const attrStr = attrs ? ` ${attrs}` : '';

    if (SELF_CLOSING.has(el.type)) {
      return `${indent}<${el.type}${attrStr} />`;
    }

    const children = el.children?.map(c => renderEl(c, indent + '  ')).join('\n') ?? '';
    const content = el.content ?? '';
    const inner = [content, children].filter(Boolean).join('\n');

    if (!inner) {
      return `${indent}<${el.type}${attrStr}></${el.type}>`;
    }

    const hasMultiline = inner.includes('\n');
    return hasMultiline
      ? `${indent}<${el.type}${attrStr}>\n${inner}\n${indent}</${el.type}>`
      : `${indent}<${el.type}${attrStr}>${inner}</${el.type}>`;
  };

  // ── Auto-inject mj-font for every Google Font in use ──────────────────────
  const manualFontEls = headEls.filter(el => el.type === 'mj-font');
  const alreadyDeclared = declaredFontNames(manualFontEls);

  const autoFontLines: string[] = [];

  // 1. Always inject DEFAULT_GOOGLE_FONTS (e.g. Inter) unless user declared them
  for (const { name, url } of DEFAULT_GOOGLE_FONTS) {
    if (!alreadyDeclared.has(name.toLowerCase())) {
      autoFontLines.push(`    <mj-font name="${name}" href="${url}" />`);
      alreadyDeclared.add(name.toLowerCase()); // prevent duplicate from step 2
    }
  }

  // 2. Inject mj-font for any additional Google Fonts found in body components
  const usedFonts = collectFontsFromElements(bodyEls);
  for (const font of usedFonts) {
    if (SYSTEM_FONTS.has(font.toLowerCase())) continue;   // skip system fonts
    if (alreadyDeclared.has(font.toLowerCase())) continue; // skip already declared
    autoFontLines.push(`    <mj-font name="${font}" href="${googleFontsUrl(font)}" />`);
  }

  // ── Assemble head block ────────────────────────────────────────────────────
  const manualHeadLines = headEls.map(el => renderEl(el, '    ')).join('\n');
  const autoFontBlock = autoFontLines.join('\n');

  const headContent = [manualHeadLines, autoFontBlock].filter(Boolean).join('\n');
  const headBlock = headContent
    ? `  <mj-head>\n${headContent}\n  </mj-head>`
    : '';

  // ── Assemble body block ────────────────────────────────────────────────────
  const bodyBlock = `  <mj-body>\n${bodyEls.map(el => renderEl(el, '    ')).join('\n')}\n  </mj-body>`;

  const parts = [headBlock, bodyBlock].filter(Boolean);
  return `<mjml>\n${parts.join('\n')}\n</mjml>`;
};
