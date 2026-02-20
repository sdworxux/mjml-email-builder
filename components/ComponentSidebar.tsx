import React, { useState } from 'react';
import { MJML_COMPONENTS, COMPONENT_GROUPS, ComponentGroup } from '../constants';
import { MJComponentType } from '../types';
import { Sun, Moon, Layout, ChevronDown, ChevronRight } from 'lucide-react';

interface ComponentSidebarProps {
  onDragStart: (e: React.DragEvent, type: MJComponentType) => void;
}

const ComponentSidebar: React.FC<ComponentSidebarProps> = ({ onDragStart }) => {
  // Which groups are expanded
  const [expanded, setExpanded] = useState<Record<ComponentGroup, boolean>>({
    head: false,
    layout: true,
    content: true,
    interactive: false,
    navigation: false,
    social: false,
  });

  const toggle = (key: ComponentGroup) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="w-64 h-full flex flex-col bg-[#F4F5F8]">
      <div className="p-6 flex-1 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center space-x-1 mb-8">
          <span className="text-xl font-bold tracking-tight text-[#001033]">
            <span className="text-[#006dd8]">mjml</span>.builder
          </span>
        </div>

        {/* Nav links */}
        <section className="mb-7">
          <h3 className="text-[10px] font-bold text-[#737477] uppercase tracking-widest mb-3 opacity-60">
            Navigation
          </h3>
          <div className="space-y-1">
            <button className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm text-[#4C4D4F] hover:bg-white hover:shadow-sm rounded-lg transition-all group cursor-pointer">
              <Layout size={16} className="text-[#737477] group-hover:text-[#006dd8] transition-colors" aria-hidden="true" />
              <span className="font-medium">My Dashboard</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm text-[#001033] bg-white shadow-sm rounded-lg cursor-pointer" aria-current="page">
              <Layout size={16} className="text-[#006dd8]" aria-hidden="true" />
              <span className="font-bold">Email Builder</span>
            </button>
          </div>
        </section>

        {/* Component groups */}
        <section>
          <h3 className="text-[10px] font-bold text-[#737477] uppercase tracking-widest mb-3 opacity-60">
            Components
          </h3>
          <div className="space-y-1">
            {COMPONENT_GROUPS.map(group => {
              const items = MJML_COMPONENTS.filter(c => c.group === group.key);
              const open = expanded[group.key];
              return (
                <div key={group.key}>
                  {/* Group header */}
                  <button
                    onClick={() => toggle(group.key)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-[#737477] uppercase tracking-wider hover:text-[#001033] hover:bg-white/60 rounded-lg transition-all cursor-pointer"
                  >
                    <span>{group.label}</span>
                    {open
                      ? <ChevronDown size={12} aria-hidden="true" />
                      : <ChevronRight size={12} aria-hidden="true" />
                    }
                  </button>

                  {/* Component list */}
                  {open && (
                    <div
                      className="ml-2 mb-2 space-y-0.5"
                      role="list"
                      aria-label={`${group.label} components`}
                    >
                      {items.map(comp => (
                        <div
                          key={comp.type}
                          draggable
                          onDragStart={e => onDragStart(e, comp.type)}
                          role="listitem"
                          title={`Drag to add ${comp.label}`}
                          aria-label={`${comp.label} — drag to add`}
                          className="flex items-center space-x-3 px-3 py-2 text-sm text-[#4C4D4F] hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-grab active:cursor-grabbing group select-none"
                        >
                          <div className="text-[#737477] group-hover:text-[#001033] transition-colors shrink-0" aria-hidden="true">
                            {comp.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">{comp.label}</p>
                            <p className="text-[9px] text-[#737477] font-mono truncate opacity-60">{comp.type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-gray-200 space-y-4 shrink-0">
        <div className="flex p-1 bg-gray-200/50 rounded-xl" role="group" aria-label="Color theme">
          <button className="flex-1 flex items-center justify-center space-x-2 py-2 bg-white rounded-lg shadow-sm text-xs font-bold text-[#001033] cursor-pointer" aria-pressed="true">
            <Sun size={13} aria-hidden="true" />
            <span>Light</span>
          </button>
          <button className="flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-bold text-[#737477] cursor-pointer hover:text-[#001033] transition-colors" aria-pressed="false">
            <Moon size={13} aria-hidden="true" />
            <span>Dark</span>
          </button>
        </div>

        <div className="p-4 bg-gray-200/30 rounded-2xl border border-gray-200/50">
          <h4 className="text-xs font-bold text-[#001033] mb-1">Help center</h4>
          <p className="text-[10px] text-[#737477] mb-3 leading-relaxed">
            Need assistance with the email interface?
          </p>
          <button className="w-full py-2 bg-[#001033] text-white text-[10px] font-bold rounded-lg hover:bg-[#002266] transition-colors cursor-pointer">
            Contact support
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComponentSidebar;
