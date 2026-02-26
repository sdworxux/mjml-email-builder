import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MJElement, MJComponentType, AppMode } from './types';
import { MJML_COMPONENTS } from './constants';
import ComponentSidebar from './components/ComponentSidebar';
import Canvas from './components/Canvas';
import PropertyEditor from './components/PropertyEditor';
import PreviewPanel from './components/PreviewPanel';
import TemplatesPanel from './components/TemplatesPanel';
import CampaignsPanel from './components/CampaignsPanel';
import AssetsPanel from './components/AssetsPanel';
import RestoreVersionModal from './components/RestoreVersionModal';
import SaveAsModal from './components/SaveAsModal';
import SendEmailModal from './components/SendEmailModal';
import {
  Save, Search, ChevronRight, Loader2,
  PanelRightClose, PanelRightOpen, Copy, History,
  PanelRight, PanelBottom, Maximize2, X,
  Mail, LayoutTemplate, ChevronDown, UserCog, User, Send,
} from 'lucide-react';
import { supabase, DBTemplate, DBTemplateHistory } from './lib/supabase';
import { generateMJML } from './services/mjmlService';

// ── Resize constants (right-dock layout only) ─────────────────────────────────
const MIN_RIGHT = 380;
const MAX_RIGHT = 1200;
const DEFAULT_RIGHT = 720;
const PROP_WIDTH = 380;       // px — property editor slice in right-dock mode
const LG_BREAKPOINT = 1440;   // initial panel position derived from this

type MainTab = 'editor' | 'templates' | 'assets' | 'campaigns';
type PanelPosition = 'right' | 'bottom' | 'fullscreen';

const autoName = () =>
  `Template ${new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`;

// ── No-selection placeholder ───────────────────────────────────────────────────
const NoSelection: React.FC = () => (
  <div className="flex-1 bg-[#FBFBFB] p-6 flex flex-col items-center justify-center text-center" aria-live="polite">
    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#737477] mb-4">
      <ChevronRight size={22} />
    </div>
    <h4 className="text-sm font-bold text-[#001033] mb-1">No selection</h4>
    <p className="text-xs text-[#737477] max-w-[160px] leading-relaxed">
      Click an element in the canvas to edit properties.
    </p>
  </div>
);

const App: React.FC = () => {
  const [elements, setElements] = useState<MJElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('editor');

  // ── Active template tracking ───────────────────────────────────────────────
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');

  // ── App mode (builder vs generator) ─────────────────────────────────────
  const [appMode, setAppMode] = useState<AppMode>('builder');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu on outside click
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node))
        setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileMenuOpen]);

  const switchMode = (mode: AppMode) => {
    setAppMode(mode);
    setProfileMenuOpen(false);
    // Ensure correct tab is active for the new mode
    if (mode === 'generator') setMainTab('editor');
    if (mode === 'builder') setMainTab('editor');
    setSelectedId(null);
  };

  // ── Active campaign tracking (generator mode) ─────────────────────────────
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [showProps, setShowProps] = useState(true);
  const [showRestore, setShowRestore] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [isSavingAs, setIsSavingAs] = useState(false);

  // ── Send email modal (generator mode) ───────────────────────────────────
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [sendHtml, setSendHtml] = useState('');
  const [isSendCompiling, setIsSendCompiling] = useState(false);

  const handleOpenSendEmail = async () => {
    if (elements.length === 0) return;
    setIsSendCompiling(true);
    try {
      const mjml = generateMJML(elements);
      const res = await fetch('/api/compile-mjml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mjml }),
      });
      const data = await res.json();
      if (!res.ok || !data.html) throw new Error(data.error ?? 'Compilation failed');
      setSendHtml(data.html);
      setShowSendEmail(true);
    } catch (err) {
      console.error('Send email compile error:', err);
    } finally {
      setIsSendCompiling(false);
    }
  };

  // ── Panel position (right | bottom | fullscreen) ───────────────────────────
  const [panelPosition, setPanelPosition] = useState<PanelPosition>(() =>
    typeof window !== 'undefined' && window.innerWidth < LG_BREAKPOINT ? 'bottom' : 'right'
  );
  // Remember position before going fullscreen so X can restore it
  const [preFullscreenPos, setPreFullscreenPos] = useState<'right' | 'bottom'>('right');

  const goFullscreen = () => {
    setPreFullscreenPos(panelPosition === 'fullscreen' ? preFullscreenPos : panelPosition as 'right' | 'bottom');
    setPanelPosition('fullscreen');
  };
  const closeFullscreen = () => setPanelPosition(preFullscreenPos);
  const setDock = (pos: 'right' | 'bottom') => setPanelPosition(pos);

  // ── Right panel width (resizable, right-dock only) ────────────────────────
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: rightWidth };
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const snap = dragRef.current;
      if (!snap) return;
      const delta = snap.startX - e.clientX;
      setRightWidth(w => Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, snap.startWidth + delta)));
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  // ── Element CRUD ───────────────────────────────────────────────────────────
  const handleAddComponent = useCallback((type: MJComponentType, parentId?: string) => {
    const config = MJML_COMPONENTS.find(c => c.type === type);
    if (!config) return;
    const el: MJElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: config.defaultContent,
      attributes: { ...config.defaultAttrs },
      children: config.isContainer ? [] : undefined,
    };
    if (parentId) {
      setElements(prev => {
        const up = (items: MJElement[]): MJElement[] =>
          items.map(item =>
            item.id === parentId && item.children
              ? { ...item, children: [...item.children, el] }
              : item.children ? { ...item, children: up(item.children) } : item
          );
        return up(prev);
      });
    } else {
      setElements(prev => [...prev, el]);
    }
    setSelectedId(el.id);
  }, []);

  const handleUpdateElement = (updated: MJElement) =>
    setElements(prev => {
      const up = (items: MJElement[]): MJElement[] =>
        items.map(item =>
          item.id === updated.id ? updated
            : item.children ? { ...item, children: up(item.children) } : item
        );
      return up(prev);
    });

  const handleDeleteElement = (id: string) => {
    const rm = (items: MJElement[]): MJElement[] =>
      items.filter(i => i.id !== id).map(i => i.children ? { ...i, children: rm(i.children) } : i);
    setElements(prev => rm(prev));
    setSelectedId(null);
  };

  // ── Move element INTO a container ─────────────────────────────────────────
  const handleMoveInto = useCallback((dragId: string, containerId: string) => {
    setElements(prev => {
      // Step 1: extract the dragged element from wherever it currently lives
      let dragged: MJElement | null = null;
      const extract = (items: MJElement[]): MJElement[] =>
        items.reduce<MJElement[]>((acc, item) => {
          if (item.id === dragId) { dragged = item; return acc; }
          return [...acc, item.children ? { ...item, children: extract(item.children) } : item];
        }, []);

      const withoutDragged = extract(prev);
      if (!dragged) return prev;

      // Step 2: append to the container's children
      const insert = (items: MJElement[]): MJElement[] =>
        items.map(item => {
          if (item.id === containerId) {
            return { ...item, children: [...(item.children ?? []), dragged!] };
          }
          return item.children ? { ...item, children: insert(item.children) } : item;
        });

      return insert(withoutDragged);
    });
  }, []);

  // ── Reorder ────────────────────────────────────────────────────────────────
  const handleReorder = useCallback((dragId: string, targetId: string, position: 'before' | 'after') => {
    setElements(prev => {
      let dragged: MJElement | null = null;
      const extract = (items: MJElement[]): MJElement[] =>
        items.reduce<MJElement[]>((acc, item) => {
          if (item.id === dragId) { dragged = item; return acc; }
          return [...acc, item.children ? { ...item, children: extract(item.children) } : item];
        }, []);

      const withoutDragged = extract(prev);
      if (!dragged) return prev;

      const insert = (items: MJElement[]): MJElement[] =>
        items.reduce<MJElement[]>((acc, item) => {
          if (item.id === targetId) {
            return position === 'before'
              ? [...acc, dragged!, item]
              : [...acc, item, dragged!];
          }
          return [...acc, item.children ? { ...item, children: insert(item.children) } : item];
        }, []);

      return insert(withoutDragged);
    });
  }, []);

  // ── Arrow-key reorder ──────────────────────────────────────────────────────
  const findSiblings = useCallback((id: string, items: MJElement[]): { siblings: MJElement[]; index: number } | null => {
    const idx = items.findIndex(el => el.id === id);
    if (idx !== -1) return { siblings: items, index: idx };
    for (const item of items) {
      if (item.children) {
        const found = findSiblings(id, item.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const handleMoveSelected = useCallback((direction: 'up' | 'down') => {
    if (!selectedId) return;
    setElements(prev => {
      const result = findSiblings(selectedId, prev);
      if (!result) return prev;
      const { siblings, index } = result;
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return prev;
      const newSiblings = [...siblings];
      [newSiblings[index], newSiblings[swapIdx]] = [newSiblings[swapIdx], newSiblings[index]];
      const patch = (items: MJElement[]): MJElement[] => {
        if (items === siblings) return newSiblings;
        return items.map(item => item.children ? { ...item, children: patch(item.children) } : item);
      };
      return patch(prev);
    });
  }, [selectedId, findSiblings]);

  // Version that accepts an explicit id — used by canvas Up/Down buttons
  const handleMoveById = useCallback((id: string, direction: 'up' | 'down') => {
    setElements(prev => {
      const result = findSiblings(id, prev);
      if (!result) return prev;
      const { siblings, index } = result;
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return prev;
      const newSiblings = [...siblings];
      [newSiblings[index], newSiblings[swapIdx]] = [newSiblings[swapIdx], newSiblings[index]];
      const patch = (items: MJElement[]): MJElement[] => {
        if (items === siblings) return newSiblings;
        return items.map(item => item.children ? { ...item, children: patch(item.children) } : item);
      };
      return patch(prev);
    });
  }, [findSiblings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if ((e.target as HTMLElement).isContentEditable) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); handleMoveSelected('up'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); handleMoveSelected('down'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, handleMoveSelected]);

  // ── Toggle element visibility (generator mode) ────────────────────────────
  const handleToggleHidden = useCallback((id: string) => {
    const toggle = (items: MJElement[]): MJElement[] =>
      items.map(item =>
        item.id === id
          ? { ...item, hidden: !item.hidden }
          : item.children
            ? { ...item, children: toggle(item.children) }
            : item
      );
    setElements(prev => toggle(prev));
  }, []);

  // ── Update section label (name) ───────────────────────────────────────────
  const handleLabelChange = useCallback((id: string, label: string) => {
    const update = (items: MJElement[]): MJElement[] =>
      items.map(item =>
        item.id === id
          ? { ...item, label: label.trim() || undefined }
          : item.children
            ? { ...item, children: update(item.children) }
            : item
      );
    setElements(prev => update(prev));
  }, []);

  // ── Save template (builder mode) ───────────────────────────────────────────
  const saveTemplate = async () => {
    if (elements.length === 0) return;
    setIsSaving(true);
    setSaveMsg(null);
    const resolvedName = templateName.trim() || autoName();
    const mjml = generateMJML(elements);
    try {
      let savedId = activeTemplateId;
      if (activeTemplateId) {
        const { error } = await supabase
          .from('templates')
          .update({ name: resolvedName, mjml, elements, updated_at: new Date().toISOString() })
          .eq('id', activeTemplateId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('templates')
          .insert({ name: resolvedName, mjml, elements })
          .select('id')
          .single();
        if (error) throw error;
        savedId = data.id;
        setActiveTemplateId(data.id);
      }
      if (savedId) {
        await supabase.from('template_history').insert({ template_id: savedId, name: resolvedName, mjml, elements });
      }
      setTemplateName(resolvedName);
      setSaveMsg('Saved ✓');
    } catch (err) {
      setSaveMsg('Save failed');
      console.error(err);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  // ── Save As (new template) ─────────────────────────────────────────────────
  const handleSaveAs = async (name: string) => {
    setIsSavingAs(true);
    const resolvedName = name.trim() || autoName();
    const mjml = generateMJML(elements);
    try {
      const { data, error } = await supabase
        .from('templates')
        .insert({ name: resolvedName, mjml, elements })
        .select('id')
        .single();
      if (error) throw error;
      await supabase.from('template_history').insert({ template_id: data.id, name: resolvedName, mjml, elements });
      setActiveTemplateId(data.id);
      setTemplateName(resolvedName);
      setShowSaveAs(false);
      setSaveMsg('Saved as new ✓');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingAs(false);
    }
  };

  // ── Save campaign (generator mode) ──────────────────────────────────────
  const saveCampaign = async () => {
    if (elements.length === 0) return;
    setIsSaving(true);
    setSaveMsg(null);
    const resolvedName = templateName.trim() || `Campaign ${new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}`;
    const mjml = generateMJML(elements);
    try {
      if (activeCampaignId) {
        const { error } = await supabase
          .from('campaigns')
          .update({ name: resolvedName, mjml, elements, updated_at: new Date().toISOString() })
          .eq('id', activeCampaignId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('campaigns')
          .insert({ name: resolvedName, mjml, elements, template_id: activeTemplateId })
          .select('id')
          .single();
        if (error) throw error;
        setActiveCampaignId(data.id);
      }
      setTemplateName(resolvedName);
      setSaveMsg('Saved ✓');
    } catch (err) {
      setSaveMsg('Save failed');
      console.error(err);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  // ── Load campaign ─────────────────────────────────────────────────────────
  const loadCampaign = (els: MJElement[], campaignId: string, campaignName: string) => {
    setElements(els);
    setSelectedId(null);
    setActiveCampaignId(campaignId);
    setTemplateName(campaignName);
    setMainTab('editor');
  };

  // ── New campaign from master template ─────────────────────────────────────
  const newCampaignFromTemplate = () => {
    // Open TemplatesPanel filtered to masters for selection
    setMainTab('templates');
  };

  // ── Load template (can start a campaign when in generator mode) ───────────
  const loadTemplate = (tpl: DBTemplate) => {
    setElements(tpl.elements as MJElement[]);
    setSelectedId(null);
    setActiveTemplateId(tpl.id);
    setTemplateName(tpl.name);
    // In generator mode, loading a template starts a new unsaved campaign
    if (appMode === 'generator') setActiveCampaignId(null);
    setMainTab('editor');
  };

  // ── Restore history version ────────────────────────────────────────────────
  const handleRestore = (snapshot: DBTemplateHistory) => {
    setElements(snapshot.elements as MJElement[]);
    setTemplateName(snapshot.name);
    setShowRestore(false);
  };

  // ── Selected element ───────────────────────────────────────────────────────
  const findSelected = (items: MJElement[]): MJElement | null => {
    for (const item of items) {
      if (item.id === selectedId) return item;
      if (item.children) { const f = findSelected(item.children); if (f) return f; }
    }
    return null;
  };
  const selectedElement = selectedId ? findSelected(elements) : null;

  // ── Shared canvas props ────────────────────────────────────────────────────
  const canvasProps = {
    elements, selectedId,
    onSelect: setSelectedId,
    onDrop: handleAddComponent,
    onReorder: handleReorder,
    onMoveInto: handleMoveInto,
    onDelete: handleDeleteElement,
    templateName,
    onNameChange: setTemplateName,
    mode: appMode,
    onToggleHidden: handleToggleHidden,
    onMoveUp: (id: string) => handleMoveById(id, 'up'),
    onMoveDown: (id: string) => handleMoveById(id, 'down'),
    onLabelChange: handleLabelChange,
  };

  // ── Shared prop panel renderer ─────────────────────────────────────────────
  const renderPropPanel = () =>
    selectedElement ? (
      <div className="flex-1 overflow-y-auto">
        <PropertyEditor
          element={selectedElement}
          onUpdate={handleUpdateElement}
          onDelete={handleDeleteElement}
          onClose={() => setSelectedId(null)}
          mode={appMode}
        />
      </div>
    ) : (
      <NoSelection />
    );

  // ── Shared right-side panel content (Props + Preview) ─────────────────────
  const renderRightPanel = (withClose = false) => (
    <div className="flex flex-1 overflow-hidden">
      {/* Property Editor slice */}
      {showProps && (
        <div className="flex flex-col border-r border-[#E2E8F0] overflow-hidden shrink-0" style={{ width: PROP_WIDTH }}>
          {renderPropPanel()}
        </div>
      )}
      {/* Preview Panel */}
      <div className="flex-1 overflow-hidden relative">
        {/* Close fullscreen button */}
        {withClose && (
          <button
            onClick={closeFullscreen}
            aria-label="Exit fullscreen"
            title="Exit fullscreen"
            className="absolute top-3 right-3 z-10 p-1.5 bg-white border border-gray-200 rounded-lg text-[#737477] hover:text-[#001033] hover:border-gray-300 shadow-sm transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        )}
        <PreviewPanel elements={elements} defaultTab="view" />
      </div>
    </div>
  );

  // ── Panel dock button helper ───────────────────────────────────────────────
  const dockBtn = (
    pos: PanelPosition,
    icon: React.ReactNode,
    label: string,
    onClick: () => void
  ) => (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-1.5 rounded-md transition-all cursor-pointer ${panelPosition === pos
        ? 'bg-[#001033] text-white shadow-sm'
        : 'text-[#737477] hover:text-[#001033] hover:bg-gray-100'
        }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="h-screen w-screen flex bg-[#F4F5F8]" id="main-content">

      {/* ── Left sidebar: Component Sidebar (builder only) ── */}
      {appMode === 'builder' && (
        <ComponentSidebar onDragStart={(e, type) => e.dataTransfer.setData('mj-type', type)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Navbar ── */}
        <header className="h-20 flex items-center justify-between px-8 bg-[#F4F5F8] shrink-0">
          <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-[10px] font-bold uppercase tracking-widest text-[#737477]">
            <span>Home</span>
            <ChevronRight size={12} />
            <span className="text-[#001033]" aria-current="page">Email Builder</span>
          </nav>
          <div className="flex items-center space-x-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737477] group-focus-within:text-[#001033] transition-colors" size={18} />
              <input type="search" id="component-search" placeholder="Search components..." aria-label="Search components"
                className="pl-12 pr-4 py-2.5 w-72 bg-white border border-transparent rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#006dd8]/20 focus:border-[#006dd8]/30 transition-all shadow-sm" />
            </div>
            <div className="flex items-center space-x-4 pl-4 border-l border-gray-200">
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-[#001033]">Stephen Howe</span>
                <span className={`text-[10px] font-bold uppercase tracking-tight ${appMode === 'builder' ? 'text-[#006dd8]' : 'text-amber-500'
                  }`}>
                  {appMode === 'builder' ? 'Administrator' : 'End User'}
                </span>
              </div>

              {/* Profile / mode switcher */}
              <div ref={profileMenuRef} className="relative">
                <button
                  onClick={() => setProfileMenuOpen(v => !v)}
                  aria-label="Switch profile"
                  aria-haspopup="true"
                  aria-expanded={profileMenuOpen}
                  className="w-10 h-10 rounded-xl bg-white border border-gray-200 overflow-hidden shadow-sm flex items-center justify-center cursor-pointer hover:border-[#006dd8]/40 hover:shadow-md transition-all"
                >
                  <img src="https://i.pravatar.cc/100?u=marc" alt="Stephen Howe" className="w-full h-full object-cover" />
                </button>

                {profileMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#737477]">Switch Profile</p>
                    </div>
                    <button
                      onClick={() => switchMode('builder')}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-gray-50 ${appMode === 'builder' ? 'bg-[#001033]/5' : ''
                        }`}
                    >
                      <div className={`p-1.5 rounded-lg ${appMode === 'builder' ? 'bg-[#001033] text-white' : 'bg-gray-100 text-[#737477]'
                        }`}>
                        <UserCog size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#001033]">Administrator</p>
                        <p className="text-[9px] text-[#737477]">Full template builder</p>
                      </div>
                      {appMode === 'builder' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#006dd8]" />}
                    </button>
                    <button
                      onClick={() => switchMode('generator')}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-gray-50 ${appMode === 'generator' ? 'bg-amber-50' : ''
                        }`}
                    >
                      <div className={`p-1.5 rounded-lg ${appMode === 'generator' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-[#737477]'
                        }`}>
                        <User size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#001033]">End User</p>
                        <p className="text-[9px] text-[#737477]">Campaign generator</p>
                      </div>
                      {appMode === 'generator' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Main work area ── */}
        <div className="flex-1 flex overflow-hidden p-8 pt-0">
          <div className="flex-1 flex flex-col bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">

            {/* ── Toolbar ── */}
            <div className="px-8 py-5 border-b border-gray-50 flex items-center justify-between shrink-0">

              {/* Left: mode badge + tabs */}
              <div className="flex items-center space-x-6">
                {appMode === 'generator' && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <Mail size={11} /> Campaign Mode
                  </span>
                )}

                <div className="flex space-x-8" role="tablist" aria-label="Editor views">
                  {/* Editor tab — always shown */}
                  <button role="tab" aria-selected={mainTab === 'editor'}
                    onClick={() => setMainTab('editor')}
                    className={`text-sm font-bold pb-4 cursor-pointer transition-colors ${mainTab === 'editor' ? 'text-[#001033] border-b-2 border-[#006dd8]' : 'text-[#737477] hover:text-[#001033]'}`}>
                    Editor
                  </button>
                  {/* Builder-only tabs */}
                  {appMode === 'builder' && (['templates', 'assets'] as const).map(tab => (
                    <button key={tab} role="tab" aria-selected={mainTab === tab}
                      onClick={() => setMainTab(tab)}
                      className={`text-sm font-bold pb-4 cursor-pointer transition-colors capitalize ${mainTab === tab ? 'text-[#001033] border-b-2 border-[#006dd8]' : 'text-[#737477] hover:text-[#001033]'}`}>
                      {tab}
                    </button>
                  ))}
                  {/* Generator-only tab */}
                  {appMode === 'generator' && (
                    <button role="tab" aria-selected={mainTab === 'campaigns'}
                      onClick={() => setMainTab('campaigns')}
                      className={`text-sm font-bold pb-4 cursor-pointer transition-colors ${mainTab === 'campaigns' ? 'text-[#001033] border-b-2 border-amber-500' : 'text-[#737477] hover:text-[#001033]'}`}>
                      Campaigns
                    </button>
                  )}
                </div>
              </div>

              {/* Right: toolbar actions */}
              <div className="flex items-center space-x-2">

                {/* ── Panel dock controls (Chrome DevTools style) ── */}
                {mainTab === 'editor' && (
                  <div
                    className="flex items-center space-x-0.5 bg-gray-50 border border-gray-200 rounded-lg p-1 mr-1"
                    role="group"
                    aria-label="Panel position"
                  >
                    {dockBtn('right', <PanelRight size={14} />, 'Dock panel to the right', () => setDock('right'))}
                    {dockBtn('bottom', <PanelBottom size={14} />, 'Dock panel to the bottom', () => setDock('bottom'))}
                    {dockBtn('fullscreen', <Maximize2 size={14} />, 'Expand panel to fullscreen', goFullscreen)}
                  </div>
                )}

                {/* Restore Version — builder mode only */}
                {activeTemplateId && appMode === 'builder' && (
                  <button
                    onClick={() => setShowRestore(true)}
                    aria-label="Restore previous version"
                    title="Restore previous version"
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white text-[#737477] hover:text-[#001033] hover:border-gray-300 transition-all cursor-pointer"
                  >
                    <History size={15} />
                    <span className="hidden md:inline">Restore Version</span>
                  </button>
                )}

                {/* Hide/Show Props */}
                <button
                  onClick={() => setShowProps(v => !v)}
                  aria-label={showProps ? 'Hide properties panel' : 'Show properties panel'}
                  title={showProps ? 'Hide properties' : 'Show properties'}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white text-[#737477] hover:text-[#001033] hover:border-gray-300 transition-all cursor-pointer"
                >
                  {showProps ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                  <span className="hidden md:inline">{showProps ? 'Hide' : 'Show'} Props</span>
                </button>

                {/* Save As — builder mode only */}
                {appMode === 'builder' && (
                  <button
                    onClick={() => setShowSaveAs(true)}
                    disabled={elements.length === 0}
                    aria-label="Save as new template"
                    title="Save as new template"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${elements.length === 0
                      ? 'border-gray-200 bg-white text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-[#737477] hover:text-[#001033] hover:border-gray-300 cursor-pointer'
                      }`}
                  >
                    <Copy size={15} />
                    <span className="hidden md:inline">Save as new template</span>
                  </button>
                )}

                {/* Send Email — generator mode only */}
                {appMode === 'generator' && mainTab === 'editor' && (
                  <button
                    onClick={handleOpenSendEmail}
                    disabled={elements.length === 0 || isSendCompiling}
                    aria-label="Send campaign as email"
                    title="Send campaign as email"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${elements.length === 0 || isSendCompiling
                        ? 'border-gray-200 bg-white text-gray-300 cursor-not-allowed'
                        : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 cursor-pointer'
                      }`}
                  >
                    {isSendCompiling
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Send size={14} />}
                    <span className="hidden md:inline">Send Email</span>
                  </button>
                )}

                {/* Save — mode-aware */}
                <button
                  onClick={appMode === 'builder' ? saveTemplate : saveCampaign}
                  disabled={isSaving || elements.length === 0}
                  aria-label={isSaving ? 'Saving…' : appMode === 'builder' ? 'Save template' : 'Save campaign'}
                  className={`flex items-center space-x-2 px-6 py-2 text-white text-xs font-bold rounded-lg transition-all active:scale-95 ${isSaving || elements.length === 0
                    ? 'bg-[#001033]/40 cursor-not-allowed'
                    : appMode === 'builder'
                      ? 'bg-[#001033] hover:bg-[#002266] cursor-pointer shadow-sm hover:shadow-md'
                      : 'bg-amber-500 hover:bg-amber-600 cursor-pointer shadow-sm hover:shadow-md'
                    }`}
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{saveMsg ?? (appMode === 'builder' ? 'Save Template' : 'Save Campaign')}</span>
                </button>
              </div>
            </div>

            {/* ── Content area ── */}
            {mainTab === 'templates' ? (
              <TemplatesPanel onLoad={loadTemplate} />
            ) : mainTab === 'assets' ? (
              <AssetsPanel />
            ) : mainTab === 'campaigns' ? (
              <CampaignsPanel
                onLoad={loadCampaign}
                onNewFromTemplate={newCampaignFromTemplate}
              />
            ) : panelPosition === 'bottom' ? (

              /* ══ BOTTOM dock ══════════════════════════════════════════════════ */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Canvas — takes all remaining height and scrolls internally.
                    Must be a flex container so Canvas's own "flex-1 overflow-y-auto"
                    root element is properly constrained and can scroll. */}
                <div className="flex-1 min-h-0 flex flex-col border-b border-[#E2E8F0]">
                  <Canvas {...canvasProps} />
                </div>
                {/* Props + Preview — fixed-height bottom row.
                    Use px height (not %) so the value is definite in the flex context. */}
                <div className="flex shrink-0 overflow-hidden" style={{ height: 360 }}>
                  {showProps && (
                    <div className="flex flex-col border-r border-[#E2E8F0] overflow-hidden shrink-0" style={{ width: '40%' }}>
                      {renderPropPanel()}
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <PreviewPanel elements={elements} defaultTab="view" />
                  </div>
                </div>
              </div>

            ) : (

              /* ══ RIGHT dock (default / desktop) ══════════════════════════════ */
              <div className="flex-1 flex overflow-hidden">
                {/* Canvas */}
                <Canvas {...canvasProps} />

                {/* Drag handle */}
                <div
                  onMouseDown={onMouseDown}
                  className="w-1.5 shrink-0 bg-[#E2E8F0] hover:bg-[#006dd8]/40 cursor-col-resize transition-colors group flex items-center justify-center"
                  role="separator" aria-orientation="vertical" aria-label="Resize panel"
                >
                  <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {[0, 1, 2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-[#006dd8]" />)}
                  </div>
                </div>

                {/* Right panel (resizable) */}
                <div
                  className="flex shrink-0 overflow-hidden border-l border-[#E2E8F0]"
                  style={{ width: rightWidth }}
                >
                  {renderRightPanel(false)}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ══ FULLSCREEN overlay ════════════════════════════════════════════════ */}
      {panelPosition === 'fullscreen' && (
        <div
          className="fixed inset-0 z-50 bg-white flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Preview panel — fullscreen"
        >
          {/* Fullscreen header bar */}
          <div className="h-12 shrink-0 flex items-center justify-between px-6 border-b border-[#E2E8F0] bg-white">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-[#001033] uppercase tracking-widest">Panel — Fullscreen</span>
              {/* Dock buttons inside fullscreen too */}
              <div className="flex items-center space-x-0.5 bg-gray-50 border border-gray-200 rounded-lg p-1" role="group" aria-label="Panel position">
                {dockBtn('right', <PanelRight size={13} />, 'Dock to the right', () => { setPanelPosition('right'); })}
                {dockBtn('bottom', <PanelBottom size={13} />, 'Dock to the bottom', () => { setPanelPosition('bottom'); })}
                {dockBtn('fullscreen', <Maximize2 size={13} />, 'Fullscreen', () => { })}
              </div>
            </div>
            <button
              onClick={closeFullscreen}
              aria-label="Exit fullscreen"
              title="Exit fullscreen — restore previous position"
              className="p-1.5 rounded-lg border border-gray-200 bg-white text-[#737477] hover:text-[#001033] hover:border-gray-300 transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <X size={15} />
              <span className="text-xs font-bold hidden sm:inline">Close</span>
            </button>
          </div>

          {/* Fullscreen content */}
          <div className="flex-1 flex overflow-hidden">
            {renderRightPanel(false)}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showRestore && activeTemplateId && (
        <RestoreVersionModal
          templateId={activeTemplateId}
          onRestore={handleRestore}
          onClose={() => setShowRestore(false)}
        />
      )}
      {showSaveAs && (
        <SaveAsModal
          defaultName={templateName}
          isSaving={isSavingAs}
          onConfirm={handleSaveAs}
          onClose={() => setShowSaveAs(false)}
        />
      )}
      {showSendEmail && sendHtml && (
        <SendEmailModal
          html={sendHtml}
          defaultSubject={templateName || 'Your Campaign'}
          onClose={() => { setShowSendEmail(false); setSendHtml(''); }}
        />
      )}
    </div>
  );
};

export default App;
