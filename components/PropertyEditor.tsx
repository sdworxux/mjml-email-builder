import React, { useState } from 'react';
import { MJElement, MJComponentType, AppMode } from '../types';
import { X, Trash2, Settings, Palette, ImageIcon, FileCode, Lock, Tag } from 'lucide-react';
import AssetsPanel, { DBAsset } from './AssetsPanel';
import ContentEditor from './ContentEditor';
import { MJML_COMPONENTS } from '../constants';


interface PropertyEditorProps {
  element: MJElement | null;
  onUpdate: (element: MJElement) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  mode: AppMode;
}

/* ── Which types carry editable HTML content ──────────────────────────────
   'wysiwyg' → rich-text editor (bold/italic/links …)
   'code'    → raw HTML / CSS textarea
   undefined → no content editor                                         */
type EditorMode = 'wysiwyg' | 'code';

const CONTENT_MODE: Partial<Record<MJComponentType, EditorMode>> = {
  // Rich-text
  'mj-text': 'wysiwyg',
  'mj-button': 'wysiwyg',
  'mj-accordion-title': 'wysiwyg',
  'mj-accordion-text': 'wysiwyg',
  'mj-navbar-link': 'wysiwyg',
  'mj-social-element': 'wysiwyg',
  // Code / HTML
  'mj-raw': 'code',
  'mj-table': 'code',
  'mj-style': 'code',
  'mj-title': 'code',
  'mj-preview': 'code',
  'mj-attributes': 'code',
  'mj-html-attributes': 'code',
};

const PropertyEditor: React.FC<PropertyEditorProps> = ({
  element, onUpdate, onDelete, onClose, mode,
}) => {
  const isGenerator = mode === 'generator';
  const [assetPickerKey, setAssetPickerKey] = useState<string | null>(null);

  if (!element) return null;

  const contentMode = CONTENT_MODE[element.type];

  const handleAttrChange = (key: string, value: string) =>
    onUpdate({ ...element, attributes: { ...element.attributes, [key]: value } });

  const handleContentChange = (content: string) =>
    onUpdate({ ...element, content });

  const handleAssetSelect = (attr: string, asset: DBAsset) => {
    handleAttrChange(attr, asset.url);
    setAssetPickerKey(null);
  };

  const isSrcAttr = (key: string) => ['src', 'background-url', 'href'].includes(key);

  // Merge defaultAttrs so attrs added to constants after a template was saved
  // always appear in the panel. Live user-set values win; we only fill gaps.
  const componentDef = MJML_COMPONENTS.find(c => c.type === element.type);
  const mergedAttrs: Record<string, string> = {
    ...(componentDef?.defaultAttrs ?? {}),
    ...element.attributes,
  };

  // Sort: mj-class first, everything else alphabetically
  const attrEntries = Object.entries(mergedAttrs).sort(([a], [b]) => {
    if (a === 'mj-class') return -1;
    if (b === 'mj-class') return 1;
    return a.localeCompare(b);
  });

  const hasAttrs = attrEntries.length > 0;

  return (
    <div className="w-full h-full bg-[#FBFBFB] flex flex-col border-l border-[#E2E8F0]">

      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center space-x-2">
          <Settings size={15} className="text-[#001033]" aria-hidden="true" />
          <div>
            <span className="text-sm font-bold text-[#001033]">Properties</span>
            <p className="text-[10px] font-mono text-[#737477]">{element.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Delete — hidden in generator mode */}
          {!isGenerator && (
            <button
              onClick={() => { onDelete(element.id); onClose(); }}
              aria-label="Delete element"
              title="Delete element"
              className="p-1.5 hover:bg-red-50 hover:text-red-500 text-[#737477] rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close property editor"
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
          >
            <X size={16} className="text-[#737477]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Generator mode lock banner */}
      {isGenerator && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2 shrink-0">
          <Lock size={11} className="text-amber-500 shrink-0" />
          <p className="text-[10px] font-bold text-amber-700">
            Content editing only — layout locked by master template
          </p>
        </div>
      )}

      {/* Scrollable body — full-height flex for code-only elements */}
      {(() => {
        const codeOnly = contentMode === 'code' && !hasAttrs && !isGenerator;
        return (
          <div className={codeOnly
            ? 'flex-1 flex flex-col p-5 gap-7 min-h-0'
            : 'flex-1 overflow-y-auto p-5 space-y-7'
          }>

            {/* ── Section Name — always first (builder mode only) ── */}
            {!isGenerator && (
              <section aria-label="Section name">
                <div className="flex items-center space-x-2 mb-3">
                  <Tag size={13} className="text-[#737477]" aria-hidden="true" />
                  <h3 className="text-[10px] font-bold text-[#737477] uppercase tracking-widest">
                    Section Name
                  </h3>
                </div>
                <input
                  id={`label-${element.id}`}
                  type="text"
                  value={element.label ?? ''}
                  onChange={e => onUpdate({ ...element, label: e.target.value.trim() ? e.target.value : undefined })}
                  placeholder="e.g. Hero, Footer, CTA…"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#001033] focus:ring-2 focus:ring-[#006dd8]/20 focus:border-[#006dd8] outline-none transition-all shadow-sm placeholder-[#B0B2B5]"
                />
                <p className="mt-1.5 text-[9px] text-[#737477] font-medium px-0.5">
                  Shown next to the section tag in the canvas editor.
                </p>
              </section>
            )}

            {/* ── Content section (WYSIWYG or code) ── */}
            {contentMode && (
              <section
                aria-label="Content editor"
                className={contentMode === 'code' && !hasAttrs && !isGenerator ? 'flex-1 flex flex-col min-h-0' : ''}
              >
                <div className="flex items-center space-x-2 mb-3">
                  <FileCode size={13} className="text-[#737477]" aria-hidden="true" />
                  <h3 className="text-[10px] font-bold text-[#737477] uppercase tracking-widest">
                    Content
                  </h3>
                </div>
                <ContentEditor
                  value={element.content ?? ''}
                  onChange={handleContentChange}
                  mode={contentMode}
                  fullHeight={contentMode === 'code' && !hasAttrs && !isGenerator}
                  placeholder={
                    contentMode === 'code'
                      ? '<!-- Enter HTML here -->'
                      : 'Type your content…'
                  }
                />
              </section>
            )}

            {/* ── Style / attribute fields — hidden in generator mode ── */}
            {hasAttrs && !isGenerator && (
              <section aria-label="Style attributes">
                <div className="flex items-center space-x-2 mb-3">
                  <Palette size={13} className="text-[#737477]" aria-hidden="true" />
                  <h3 className="text-[10px] font-bold text-[#737477] uppercase tracking-widest">
                    Style Attributes
                  </h3>
                </div>

                <div className="space-y-4">
                  {attrEntries.map(([key, val]) => {
                    const pickerOpen = assetPickerKey === key;
                    const showPicker = isSrcAttr(key);

                    /* ── Colour swatch inline for colour-like attrs ── */
                    const isColor = key.toLowerCase().includes('color') || key.toLowerCase().includes('colour');
                    const isUrl = key.includes('url') || key === 'href' || key === 'src';

                    return (
                      <div key={key}>
                        <label
                          htmlFor={`attr-${element.id}-${key}`}
                          className="block text-[10px] font-bold text-[#737477] uppercase tracking-tight mb-1 px-0.5"
                        >
                          {key.replace(/-/g, ' ')}
                        </label>

                        <div className="flex gap-2 items-center">
                          {/* Colour preview pill */}
                          {isColor && val && String(val).startsWith('#') && (
                            <div
                              className="w-5 h-5 rounded-md border border-gray-200 shrink-0"
                              style={{ background: val }}
                              aria-hidden="true"
                            />
                          )}

                          <input
                            id={`attr-${element.id}-${key}`}
                            type={isColor ? 'text' : 'text'}
                            value={val}
                            onChange={e => handleAttrChange(key, e.target.value)}
                            className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#001033] focus:ring-2 focus:ring-[#006dd8]/20 focus:border-[#006dd8] outline-none transition-all shadow-sm"
                            placeholder={isColor ? '#rrggbb' : isUrl ? 'https://' : ''}
                          />

                          {/* Asset picker toggle for URL-like attrs */}
                          {showPicker && (
                            <button
                              type="button"
                              onClick={() => setAssetPickerKey(pickerOpen ? null : key)}
                              aria-label={pickerOpen ? 'Close asset picker' : 'Pick from assets'}
                              title="Pick from assets"
                              className={`shrink-0 p-2 rounded-xl border transition-all cursor-pointer ${pickerOpen
                                ? 'bg-[#006dd8] border-[#006dd8] text-white'
                                : 'bg-white border-gray-200 text-[#737477] hover:border-[#006dd8] hover:text-[#006dd8]'
                                }`}
                            >
                              <ImageIcon size={14} aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {/* Inline asset picker */}
                        {showPicker && pickerOpen && (
                          <div className="mt-3 p-3 bg-white border border-[#006dd8]/20 rounded-xl shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-[#737477] uppercase tracking-wider flex items-center space-x-1">
                                <ImageIcon size={10} />
                                <span>Pick an asset</span>
                              </span>
                              <button
                                onClick={() => setAssetPickerKey(null)}
                                aria-label="Close picker"
                                className="p-0.5 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                              >
                                <X size={12} className="text-[#737477]" />
                              </button>
                            </div>
                            <AssetsPanel
                              pickerMode
                              onSelect={asset => handleAssetSelect(key, asset)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Placeholder for container/no-attribute types */}
            {!hasAttrs && !contentMode && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-[#737477]">
                <Settings size={24} className="mb-2 opacity-30" />
                <p className="text-xs font-medium">No configurable properties</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Footer — delete */}
      <div className="p-5 border-t border-[#E2E8F0] shrink-0">
        <button
          onClick={() => onDelete(element.id)}
          aria-label={`Remove ${element.type} component`}
          className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-white border border-gray-200 text-[#737477] hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all font-bold text-xs cursor-pointer"
        >
          <Trash2 size={14} aria-hidden="true" />
          <span>Remove Component</span>
        </button>
      </div>
    </div>
  );
};

export default PropertyEditor;
