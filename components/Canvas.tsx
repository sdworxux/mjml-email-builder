import React, { useState } from 'react';
import { MJElement, MJComponentType } from '../types';
import { MJML_COMPONENTS } from '../constants';
import { Plus, GripVertical, Trash2, Layout } from 'lucide-react';

interface CanvasProps {
  elements: MJElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDrop: (type: MJComponentType, parentId?: string) => void;
  onReorder: (dragId: string, targetId: string, position: 'before' | 'after') => void;
  onMoveInto: (dragId: string, containerId: string) => void;
  onDelete: (id: string) => void;
  templateName: string;
  onNameChange: (name: string) => void;
}

interface DropIndicator {
  targetId: string;
  position: 'before' | 'after' | 'inside';
}

const Canvas: React.FC<CanvasProps> = ({
  elements, selectedId, onSelect, onDrop, onReorder, onMoveInto, onDelete,
  templateName, onNameChange,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  // Which container is highlighted for an incoming sidebar component
  const [containerHighlight, setContainerHighlight] = useState<string | null>(null);

  // ── Differentiate drag sources ────────────────────────────────────────────
  const isSidebarDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('mj-type');
  const isReorderDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('reorder-id');

  // ── Grip handle ───────────────────────────────────────────────────────────
  const onGripDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('reorder-id', id);
    e.dataTransfer.effectAllowed = 'move';
    // Delay so the browser captures the drag image BEFORE React re-renders
    // the source element to its dimmed/transparent state. Without this,
    // Chrome detects a DOM change during dragstart and cancels the drag immediately.
    setTimeout(() => setDraggingId(id), 0);
  };
  const onGripDragEnd = () => {
    setDraggingId(null);
    setDropIndicator(null);
  };

  // ── Position detection ────────────────────────────────────────────────────
  // For containers: three zones → before (top 25%) | inside (middle 50%) | after (bottom 25%)
  // For leaf elements: two zones → before / after split at midpoint
  const getPosition = (e: React.DragEvent, isContainer: boolean): 'before' | 'after' | 'inside' => {
    const { top, height } = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pct = (e.clientY - top) / height;
    if (isContainer) {
      if (pct < 0.25) return 'before';
      if (pct > 0.75) return 'after';
      return 'inside';
    }
    return pct < 0.5 ? 'before' : 'after';
  };

  // ── Per-card drag handlers ────────────────────────────────────────────────
  //
  //  REORDER drags  → always stopPropagation (we need per-element accuracy)
  //  SIDEBAR drags  → containers stop propagation (they own the drop)
  //                   non-containers DON'T stop propagation so the event
  //                   bubbles up to the nearest container ancestor
  //
  const onCardDragOver = (e: React.DragEvent, elId: string, isContainer: boolean) => {
    if (isReorderDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      const position = getPosition(e, isContainer);
      setDropIndicator(prev =>
        prev?.targetId === elId && prev?.position === position
          ? prev
          : { targetId: elId, position },
      );
      // 'inside' zone: also show the container highlight so it's doubly clear
      if (isContainer && position === 'inside') {
        setContainerHighlight(elId);
      } else if (containerHighlight === elId) {
        setContainerHighlight(null);
      }
    } else if (isSidebarDrag(e)) {
      e.preventDefault();
      if (isContainer) {
        e.stopPropagation();
        setContainerHighlight(elId);
      }
    }
  };

  const onCardDragLeave = (e: React.DragEvent, elId: string) => {
    const related = e.relatedTarget as Node | null;
    if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
      setDropIndicator(null);
      if (containerHighlight === elId) setContainerHighlight(null);
    }
  };

  const onCardDrop = (e: React.DragEvent, elId: string, isContainer: boolean) => {
    if (isReorderDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      const dragId = e.dataTransfer.getData('reorder-id');
      if (dragId && dragId !== elId) {
        const position = getPosition(e, isContainer);
        if (position === 'inside' && isContainer) {
          onMoveInto(dragId, elId);             // nest into this container
        } else {
          onReorder(dragId, elId, position as 'before' | 'after');
        }
      }
      setDraggingId(null);
      setDropIndicator(null);
      setContainerHighlight(null);
    } else if (isSidebarDrag(e)) {
      if (isContainer) {
        e.preventDefault();
        e.stopPropagation();
        const type = e.dataTransfer.getData('mj-type') as MJComponentType;
        if (type) onDrop(type, elId);
        setContainerHighlight(null);
      }
    }
  };

  // ── Canvas root-level drop ────────────────────────────────────────────────
  const onCanvasDragOver = (e: React.DragEvent) => {
    if (isSidebarDrag(e) || isReorderDrag(e)) e.preventDefault();
  };
  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('mj-type') as MJComponentType;
    if (type) onDrop(type);          // add to root
    setDraggingId(null);
    setDropIndicator(null);
    setContainerHighlight(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const renderCard = (el: MJElement, depth = 0): React.ReactNode => {
    const isActive = selectedId === el.id;
    const isDragging = draggingId === el.id;
    const config = MJML_COMPONENTS.find(c => c.type === el.type);
    const isContainer = config?.isContainer ?? false;
    const indicator = dropIndicator?.targetId === el.id ? dropIndicator.position : null;
    const isHighlight = containerHighlight === el.id;

    return (
      <div key={el.id} className={`relative ${depth === 0 ? 'mb-2' : 'my-1'}`}>

        {/* Before-drop indicator */}
        <div
          aria-hidden="true"
          className={`h-0.5 rounded-full transition-all duration-100 ${indicator === 'before'
            ? 'bg-[#006dd8] shadow-sm shadow-[#006dd8]/40 mb-1'
            : 'bg-transparent'
            }`}
        />

        {/* Card */}
        <div
          onDragOver={e => onCardDragOver(e, el.id, isContainer)}
          onDragLeave={e => onCardDragLeave(e, el.id)}
          onDrop={e => onCardDrop(e, el.id, isContainer)}
          onClick={ev => { ev.stopPropagation(); onSelect(el.id); }}
          onKeyDown={ev => {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.stopPropagation(); onSelect(el.id); }
          }}
          role="button"
          tabIndex={0}
          aria-selected={isActive}
          aria-label={`${el.type.replace('mj-', '')} element`}
          className={[
            'group transition-all duration-150 cursor-pointer select-none',
            isDragging ? 'opacity-30 scale-[0.98] pointer-events-none' : '',
            isActive
              ? 'bg-white shadow-xl ring-2 ring-[#001033]/5'
              : 'bg-[#F9FAFB] hover:bg-white hover:shadow-md',
            isContainer
              ? `min-h-[80px] p-5 rounded-2xl border-2 ${indicator === 'inside'
                ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-300/30' // reorder→inside
                : isHighlight
                  ? 'border-[#006dd8] bg-[#006dd8]/5'                              // sidebar→inside
                  : 'border-gray-100'
              }`
              : 'p-4 rounded-xl border border-gray-100',
          ].join(' ')}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isActive ? 'bg-[#006dd8] text-white' : 'bg-gray-100 text-[#737477]'
                }`}>
                {el.type.replace('mj-', '')}
              </span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-[#006dd8] animate-pulse" aria-hidden="true" />
              )}
            </div>

            {/* Hover actions */}
            <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onDelete(el.id); }}
                aria-label={`Delete ${el.type.replace('mj-', '')} element`}
                title="Delete"
                className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-[#737477] transition-all cursor-pointer"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>

              {/* Grip — only draggable element */}
              <div
                draggable
                onDragStart={e => onGripDragStart(e, el.id)}
                onDragEnd={onGripDragEnd}
                onClick={e => e.stopPropagation()}
                title="Drag to reorder"
                aria-label="Drag to reorder"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-[#737477] transition-all cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={13} aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Body */}
          {isContainer ? (
            <>
              {indicator === 'inside' && (
                <p className="text-[10px] text-indigo-500 font-bold text-center mb-2 animate-pulse">
                  ↓ Release to nest inside
                </p>
              )}
              {isHighlight && !el.children?.length && indicator !== 'inside' && (
                <p className="text-[10px] text-[#006dd8] font-bold text-center mb-2 animate-pulse">
                  Drop to add inside
                </p>
              )}
              {el.children?.length ? (
                <div className="space-y-1">
                  {el.children.map(child => renderCard(child, depth + 1))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 text-[#737477]">
                  <Plus size={18} className="mb-2 opacity-40" aria-hidden="true" />
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                    Drop sub-components here
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center space-x-4">
              <div className={`p-2 rounded-lg shrink-0 transition-colors ${isActive ? 'bg-[#001033] text-white' : 'bg-white text-[#737477]'
                }`} aria-hidden="true">
                {config?.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#001033] truncate">
                  {el.content || el.type.replace('mj-', '')}
                </p>
                <p className="text-[10px] text-[#737477] font-medium mt-0.5">
                  {Object.entries(el.attributes).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* After-drop indicator */}
        <div
          aria-hidden="true"
          className={`h-0.5 rounded-full transition-all duration-100 ${indicator === 'after'
            ? 'bg-[#006dd8] shadow-sm shadow-[#006dd8]/40 mt-1'
            : 'bg-transparent'
            }`}
        />
      </div>
    );
  };

  return (
    <div
      className="flex-1 overflow-y-auto p-12 bg-white"
      onDragOver={onCanvasDragOver}
      onDrop={onCanvasDrop}
      onDragLeave={() => { setDropIndicator(null); setContainerHighlight(null); }}
    >
      <div className="max-w-2xl mx-auto min-h-full">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-black text-[#001033]">Campaign Editor</h1>
            <div className="flex -space-x-1" aria-hidden="true">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 shadow-sm" />
              ))}
            </div>
          </div>
          {/* Template name input */}
          <input
            type="text"
            value={templateName}
            onChange={e => onNameChange(e.target.value)}
            placeholder="Untitled template — click to name it"
            aria-label="Template name"
            className="w-full px-4 py-2.5 bg-[#F4F5F8] border border-transparent hover:border-gray-200 focus:border-[#006dd8] focus:bg-white focus:ring-2 focus:ring-[#006dd8]/20 rounded-xl text-sm font-bold text-[#001033] placeholder-[#B0B2B5] outline-none transition-all"
          />
        </div>

        <div role="list" aria-label="Email elements" aria-live="polite" className="min-h-[200px]">
          {elements.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center border-4 border-dashed border-gray-100 rounded-[40px] p-24 text-center"
              aria-label="Empty canvas"
            >
              <div className="w-20 h-20 bg-[#F4F5F8] rounded-3xl flex items-center justify-center text-[#001033] mb-8 shadow-inner" aria-hidden="true">
                <Layout size={40} />
              </div>
              <h2 className="text-xl font-bold text-[#001033] mb-2">Build your layout</h2>
              <p className="text-sm text-[#737477] max-w-[240px] leading-relaxed">
                Drag a <b>Section</b> from the sidebar to start creating your email.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {elements.map(el => renderCard(el))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Canvas;
