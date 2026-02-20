
export type MJComponentType =
  // ── Head ──────────────────────────────────────────────────────────────────
  | 'mj-attributes'
  | 'mj-breakpoint'
  | 'mj-font'
  | 'mj-html-attributes'
  | 'mj-preview'
  | 'mj-style'
  | 'mj-title'
  // ── Body: layout ──────────────────────────────────────────────────────────
  | 'mj-wrapper'
  | 'mj-section'
  | 'mj-column'
  | 'mj-group'
  | 'mj-hero'
  // ── Body: content ─────────────────────────────────────────────────────────
  | 'mj-text'
  | 'mj-button'
  | 'mj-image'
  | 'mj-divider'
  | 'mj-spacer'
  | 'mj-table'
  | 'mj-raw'
  // ── Body: interactive ─────────────────────────────────────────────────────
  | 'mj-accordion'
  | 'mj-accordion-element'
  | 'mj-accordion-title'
  | 'mj-accordion-text'
  | 'mj-carousel'
  | 'mj-carousel-image'
  // ── Body: navigation ──────────────────────────────────────────────────────
  | 'mj-navbar'
  | 'mj-navbar-link'
  // ── Body: social ──────────────────────────────────────────────────────────
  | 'mj-social'
  | 'mj-social-element';

export interface MJElement {
  id: string;
  type: MJComponentType;
  content?: string;
  attributes: Record<string, string>;
  children?: MJElement[];
  /** When true the element is excluded from MJML output and dimmed in the canvas */
  hidden?: boolean;
  /** Display label override shown in the Component Navigator */
  label?: string;
}

export interface Template {
  id: string;
  name: string;
  elements: MJElement[];
  updatedAt: number;
}

/** Controls which profile/mode the app is running in */
export type AppMode = 'builder' | 'generator';
