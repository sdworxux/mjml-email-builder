import React, { useEffect, useRef, useState } from 'react';
import { generateMJML } from '../services/mjmlService';
import { MJElement } from '../types';
import { Copy, Eye, Code, Check, Loader2, AlertTriangle, FileCode, ChevronDown } from 'lucide-react';

interface PreviewPanelProps {
  elements: MJElement[];
  /** Which tab should open by default. Defaults to 'mjml'. */
  defaultTab?: Tab;
}

type Tab = 'mjml' | 'html' | 'view';

type CompileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; html: string; errors: MJMLError[] }
  | { status: 'error'; message: string };

interface MJMLError {
  formattedMessage?: string;
  message?: string;
  tagName?: string;
  line?: number;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ elements, defaultTab = 'view' }) => {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [compile, setCompile] = useState<CompileState>({ status: 'idle' });
  const [warningsOpen, setWarningsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Export split-button state ──────────────────────────────────────────────
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedMjml, setCopiedMjml] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Clipboard helper (with execCommand fallback) ───────────────────────────
  const copyToClipboard = async (text: string): Promise<void> => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Fallback for non-secure contexts (HTTP) or older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!ok) throw new Error('Clipboard write failed — please copy manually from the source tab.');
  };

  const showExportError = (msg: string) => {
    setExportError(msg);
    setTimeout(() => setExportError(null), 5000);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const mjml = generateMJML(elements);

  // ── Compile on demand (used by export-HTML action) ─────────────────────────
  const compileForExport = (): Promise<string> => {
    // Already have a fresh result — use it immediately
    if (compile.status === 'success') return Promise.resolve(compile.html);

    return new Promise((resolve, reject) => {
      fetch('/api/compile-mjml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mjml }),
      })
        .then(async res => {
          const data = await res.json();
          if (!res.ok || !data.html) throw new Error(data.error ?? 'No HTML');
          setCompile({ status: 'success', html: data.html, errors: data.errors ?? [] });
          resolve(data.html);
        })
        .catch(reject);
    });
  };

  // ── Export actions ─────────────────────────────────────────────────────────
  const handleExportHtml = async () => {
    if (elements.length === 0) return;
    setExporting(true);
    setExportError(null);
    try {
      const html = await compileForExport();
      await copyToClipboard(html);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed — unknown error';
      showExportError(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleExportMjml = async () => {
    setDropdownOpen(false);
    setExportError(null);
    try {
      await copyToClipboard(mjml);
      setCopiedMjml(true);
      setTimeout(() => setCopiedMjml(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed — unknown error';
      showExportError(msg);
    }
  };
  useEffect(() => {
    // Nothing to do when on the source tab
    if (tab === 'mjml') return;

    // No components in canvas yet
    if (elements.length === 0) {
      setCompile({ status: 'idle' });
      return;
    }

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCompile({ status: 'loading' });

    fetch('/api/compile-mjml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mjml }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.html) {
          throw new Error(data.error ?? 'Compilation returned no HTML');
        }
        setCompile({ status: 'success', html: data.html, errors: data.errors ?? [] });
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setCompile({ status: 'error', message: err.message });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mjml]);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const compiledHtml = compile.status === 'success' ? compile.html : '';

  // ── Shared empty / loading / error states ──────────────────────────────────
  const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
      <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#737477] mb-5" aria-hidden="true">
        <Eye size={22} />
      </div>
      <h3 className="text-sm font-bold text-[#001033] mb-1">Nothing to preview</h3>
      <p className="text-xs text-[#737477] max-w-[190px] leading-relaxed">
        Add a component to the canvas first, then switch to HTML or VIEW.
      </p>
    </div>
  );

  const LoadingState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-10">
      <Loader2 size={28} className="animate-spin text-[#006dd8] mb-3" />
      <p className="text-xs text-[#737477] font-medium">Compiling MJML…</p>
    </div>
  );

  const ErrorState = ({ message }: { message: string }) => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-400 mb-5">
        <AlertTriangle size={22} />
      </div>
      <h3 className="text-sm font-bold text-red-600 mb-1">Compilation failed</h3>
      <p className="text-[10px] text-[#737477] max-w-[220px] leading-relaxed font-mono break-all">{message}</p>
    </div>
  );

  const WarningBanner = () => {
    if (compile.status !== 'success' || compile.errors.length === 0) return null;
    const count = compile.errors.length;
    return (
      <div className="shrink-0 border-b border-amber-100">
        {/* Header row — always visible, click to expand */}
        <button
          onClick={() => setWarningsOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-2 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer text-left"
          aria-expanded={warningsOpen}
          aria-label={`${count} MJML warning${count > 1 ? 's' : ''} — click to ${warningsOpen ? 'collapse' : 'expand'}`}
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle size={11} className="text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-700 font-semibold">
              {count} warning{count > 1 ? 's' : ''} — preview may differ slightly
            </p>
          </div>
          <ChevronDown
            size={11}
            className={`text-amber-500 transition-transform duration-150 ${warningsOpen ? 'rotate-180' : ''
              }`}
          />
        </button>

        {/* Expandable detail list */}
        {warningsOpen && (
          <div className="bg-amber-50 px-5 pb-3 space-y-1 max-h-48 overflow-y-auto">
            {compile.errors.map((err, i) => {
              const e = err as MJMLError;
              const text = e.formattedMessage ?? e.message ?? JSON.stringify(err);
              return (
                <p key={i} className="text-[10px] font-mono text-amber-800 leading-snug">
                  {text}
                </p>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-[#FBFBFB] flex flex-col">

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between bg-white shrink-0">
        <div className="flex space-x-0.5 p-1 bg-gray-100 rounded-xl" role="tablist" aria-label="Preview panel">

          {/* VIEW tab — first */}
          <button
            role="tab"
            aria-selected={tab === 'view'}
            onClick={() => setTab('view')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${tab === 'view' ? 'bg-white shadow-sm text-[#001033]' : 'text-[#737477] hover:text-[#001033]'
              }`}
          >
            <Eye size={11} aria-hidden="true" />
            <span>View</span>
            {tab === 'view' && compile.status === 'loading' && (
              <Loader2 size={9} className="animate-spin text-[#006dd8]" />
            )}
            {compile.status === 'error' && tab === 'view' && (
              <AlertTriangle size={9} className="text-red-400" />
            )}
          </button>

          {/* HTML tab */}
          <button
            role="tab"
            aria-selected={tab === 'html'}
            onClick={() => setTab('html')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${tab === 'html' ? 'bg-white shadow-sm text-[#001033]' : 'text-[#737477] hover:text-[#001033]'
              }`}
          >
            <FileCode size={11} aria-hidden="true" />
            <span>HTML</span>
            {tab === 'html' && compile.status === 'loading' && (
              <Loader2 size={9} className="animate-spin text-[#006dd8]" />
            )}
          </button>

          {/* MJML tab */}
          <button
            role="tab"
            aria-selected={tab === 'mjml'}
            onClick={() => setTab('mjml')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${tab === 'mjml' ? 'bg-white shadow-sm text-[#001033]' : 'text-[#737477] hover:text-[#001033]'
              }`}
          >
            <Code size={11} aria-hidden="true" />
            <span>MJML</span>
          </button>
        </div>

        {/* ── Split Export button ─────────────────────────────────────── */}
        <div ref={dropdownRef} className="relative flex">
          {/* Export error toast */}
          {exportError && (
            <div
              role="alert"
              className="absolute bottom-full right-0 mb-2 w-72 flex items-start gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl shadow-lg z-50 animate-fade-in"
            >
              <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-700 font-medium leading-snug">{exportError}</p>
            </div>
          )}
          {/* Primary action: Copy HTML */}
          <button
            onClick={handleExportHtml}
            disabled={elements.length === 0 || exporting}
            aria-label={copiedHtml ? 'HTML copied!' : 'Copy compiled HTML to clipboard'}
            title="Copy compiled HTML"
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-l-lg text-[10px] font-bold border-y border-l transition-all cursor-pointer ${elements.length === 0
              ? 'bg-white border-gray-200 text-gray-300 cursor-not-allowed'
              : copiedHtml
                ? 'bg-green-50 border-green-200 text-green-600'
                : 'bg-white border-gray-200 text-[#001033] hover:bg-gray-50'
              }`}
          >
            {exporting
              ? <Loader2 size={11} className="animate-spin" />
              : copiedHtml
                ? <Check size={11} />
                : <Copy size={11} />}
            <span>{copiedHtml ? 'Copied!' : 'Export HTML'}</span>
          </button>

          {/* Divider */}
          <div className={`w-px shrink-0 self-stretch border-y ${elements.length === 0 ? 'bg-gray-200 border-gray-200' : 'bg-gray-200 border-gray-200'
            }`} />

          {/* Dropdown chevron */}
          <button
            onClick={() => setDropdownOpen(v => !v)}
            disabled={elements.length === 0}
            aria-label="More export options"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            className={`flex items-center justify-center px-2 py-1.5 rounded-r-lg text-[10px] font-bold border-y border-r transition-all ${elements.length === 0
              ? 'bg-white border-gray-200 text-gray-300 cursor-not-allowed'
              : dropdownOpen
                ? 'bg-gray-100 border-gray-200 text-[#001033] cursor-pointer'
                : 'bg-white border-gray-200 text-[#737477] hover:bg-gray-50 hover:text-[#001033] cursor-pointer'
              }`}
          >
            <ChevronDown size={11} className={`transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              className="absolute top-full right-0 mt-1.5 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
              role="menu"
            >
              <button
                onClick={handleExportMjml}
                role="menuitem"
                className="w-full flex items-center space-x-2.5 px-4 py-3 text-left text-xs font-bold text-[#737477] hover:bg-gray-50 hover:text-[#001033] transition-colors cursor-pointer"
              >
                {copiedMjml
                  ? <><Check size={13} className="text-green-500" /><span className="text-green-600">MJML Copied!</span></>
                  : <><FileCode size={13} /><span>Copy MJML source</span></>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Panel body ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* ── Tab: MJML source ── */}
        {tab === 'mjml' && (
          <div className="flex-1 overflow-auto p-5 font-mono text-[11px] text-[#4C4D4F] leading-relaxed">
            <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm min-h-full">
              {mjml.split('\n').map((line, i) => (
                <div key={i} className="group flex hover:bg-gray-50 rounded">
                  <span className="w-8 shrink-0 text-gray-300 select-none text-[9px] pt-0.5 group-hover:text-[#737477] transition-colors">
                    {i + 1}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all">{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: HTML compiled source ── */}
        {tab === 'html' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {compile.status === 'idle' && <EmptyState />}
            {compile.status === 'loading' && <LoadingState />}
            {compile.status === 'error' && <ErrorState message={compile.message} />}
            {compile.status === 'success' && (
              <>
                <WarningBanner />
                <div className="flex-1 overflow-auto p-5 font-mono text-[11px] text-[#4C4D4F] leading-relaxed">
                  <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm min-h-full">
                    {compiledHtml.split('\n').map((line, i) => (
                      <div key={i} className="group flex hover:bg-gray-50 rounded">
                        <span className="w-8 shrink-0 text-gray-300 select-none text-[9px] pt-0.5 group-hover:text-[#737477] transition-colors">
                          {i + 1}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-all">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab: VIEW — rendered email in sandboxed iframe ── */}
        {tab === 'view' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {compile.status === 'idle' && <EmptyState />}
            {compile.status === 'loading' && <LoadingState />}
            {compile.status === 'error' && <ErrorState message={compile.message} />}
            {compile.status === 'success' && (
              <>
                <WarningBanner />
                <iframe
                  key={compiledHtml}
                  title="Rendered email preview"
                  srcDoc={compiledHtml}
                  sandbox="allow-same-origin"
                  className="flex-1 w-full border-0 bg-white"
                  aria-label="Rendered email preview"
                />
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default PreviewPanel;
