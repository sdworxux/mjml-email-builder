import React from 'react';
import { MJElement } from '../types';
import { Eye, EyeOff, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { MJML_COMPONENTS } from '../constants';

interface ComponentNavigatorProps {
    elements: MJElement[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onToggleHidden: (id: string) => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
}

const ComponentNavigator: React.FC<ComponentNavigatorProps> = ({
    elements,
    selectedId,
    onSelect,
    onToggleHidden,
    onMoveUp,
    onMoveDown,
}) => {
    const renderRow = (el: MJElement, siblings: MJElement[], index: number, depth = 0): React.ReactNode => {
        const isActive = selectedId === el.id;
        const isHidden = el.hidden === true;
        const config = MJML_COMPONENTS.find(c => c.type === el.type);
        const isFirst = index === 0;
        const isLast = index === siblings.length - 1;
        const hasChildren = el.children && el.children.length > 0;

        return (
            <div key={el.id}>
                {/* Row */}
                <div
                    onClick={() => onSelect(el.id)}
                    className={[
                        'group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer rounded-lg transition-all select-none',
                        isActive
                            ? 'bg-[#001033] text-white'
                            : 'hover:bg-gray-50 text-[#001033]',
                        isHidden ? 'opacity-40' : '',
                    ].join(' ')}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    role="button"
                    tabIndex={0}
                    aria-selected={isActive}
                    aria-label={`${el.type.replace('mj-', '')} element`}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(el.id); }}
                >
                    {/* Depth connector */}
                    {depth > 0 && (
                        <ChevronRight
                            size={10}
                            className={`shrink-0 ${isActive ? 'text-white/60' : 'text-gray-300'}`}
                            aria-hidden="true"
                        />
                    )}

                    {/* Icon */}
                    <span
                        className={`shrink-0 ${isActive ? 'text-white/80' : 'text-[#737477]'}`}
                        aria-hidden="true"
                    >
                        {config?.icon}
                    </span>

                    {/* Label */}
                    <span className={`flex-1 min-w-0 text-xs font-bold truncate ${isActive ? 'text-white' : ''}`}>
                        {el.label || el.content
                            ? (el.label || el.content)?.replace(/<[^>]+>/g, '').slice(0, 30)
                            : el.type.replace('mj-', '')}
                    </span>

                    {/* Actions — Up / Down / Visibility */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={e => { e.stopPropagation(); onMoveUp(el.id); }}
                            disabled={isFirst}
                            aria-label="Move up"
                            title="Move up"
                            className={`p-0.5 rounded transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-100 text-[#737477]'
                                }`}
                        >
                            <ChevronUp size={12} />
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); onMoveDown(el.id); }}
                            disabled={isLast}
                            aria-label="Move down"
                            title="Move down"
                            className={`p-0.5 rounded transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-100 text-[#737477]'
                                }`}
                        >
                            <ChevronDown size={12} />
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); onToggleHidden(el.id); }}
                            aria-label={isHidden ? 'Show block' : 'Hide block'}
                            title={isHidden ? 'Show block' : 'Hide block'}
                            className={`p-0.5 rounded transition-colors cursor-pointer ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-100 text-[#737477]'
                                }`}
                        >
                            {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                    </div>
                </div>

                {/* Children */}
                {hasChildren && (
                    <div>
                        {el.children!.map((child, i) => renderRow(child, el.children!, i, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-[220px] shrink-0 h-full bg-[#FBFBFB] border-r border-[#E2E8F0] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-4 border-b border-[#E2E8F0] shrink-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#737477]">Navigator</p>
                <p className="text-[9px] text-[#B0B2B5] mt-0.5">Toggle visibility · reorder blocks</p>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-2">
                {elements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center text-[#737477]">
                        <p className="text-xs font-medium opacity-50">No blocks yet</p>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {elements.map((el, i) => renderRow(el, elements, i, 0))}
                    </div>
                )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-3 border-t border-[#E2E8F0] shrink-0">
                <p className="text-[9px] text-[#B0B2B5] leading-relaxed">
                    <span className="font-bold text-[#737477]">Hover</span> a row to reveal controls.
                    <br />Hidden blocks are excluded from the email.
                </p>
            </div>
        </div>
    );
};

export default ComponentNavigator;
