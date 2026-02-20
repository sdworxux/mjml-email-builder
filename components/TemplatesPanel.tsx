import React, { useEffect, useState, useCallback } from 'react';
import { supabase, DBTemplate } from '../lib/supabase';
import { Loader2, Mail, Trash2, AlertTriangle, RefreshCw, Calendar, Clock } from 'lucide-react';

interface TemplatesPanelProps {
    onLoad: (template: DBTemplate) => void;
}

const TemplatesPanel: React.FC<TemplatesPanelProps> = ({ onLoad }) => {
    const [templates, setTemplates] = useState<DBTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: err } = await supabase
            .from('templates')
            .select('*')
            .order('updated_at', { ascending: false });
        if (err) setError(err.message);
        else setTemplates((data as DBTemplate[]) ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        setDeleting(id);
        const { error: err } = await supabase.from('templates').delete().eq('id', id);
        if (err) alert(err.message);
        else setTemplates(prev => prev.filter(t => t.id !== id));
        setDeleting(null);
    };

    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });
    const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeStyle: 'short' });

    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-[#FBFBFB]">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[#E2E8F0] bg-white flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-base font-bold text-[#001033]">Saved Templates</h2>
                    <p className="text-xs text-[#737477] mt-0.5">Click a template to open it in the canvas editor.</p>
                </div>
                <button onClick={fetchTemplates} disabled={loading} aria-label="Refresh templates"
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white text-[#737477] hover:text-[#001033] hover:border-gray-300 transition-all cursor-pointer disabled:opacity-50">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <Loader2 size={28} className="animate-spin text-[#006dd8] mb-3" />
                        <p className="text-xs text-[#737477] font-medium">Loading templates…</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-400 mb-4">
                            <AlertTriangle size={22} />
                        </div>
                        <h3 className="text-sm font-bold text-red-600 mb-1">Could not load templates</h3>
                        <p className="text-xs text-[#737477] mb-4">{error}</p>
                        <button onClick={fetchTemplates}
                            className="px-4 py-2 bg-[#001033] text-white text-xs font-bold rounded-lg hover:bg-[#002266] transition-colors cursor-pointer">
                            Try again
                        </button>
                    </div>
                )}

                {!loading && !error && templates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#737477] mb-6">
                            <Mail size={28} />
                        </div>
                        <h3 className="text-sm font-bold text-[#001033] mb-2">No templates yet</h3>
                        <p className="text-xs text-[#737477] max-w-[220px] leading-relaxed">
                            Build an email in the canvas and click <strong>Save Template</strong> to store it here.
                        </p>
                    </div>
                )}

                {!loading && !error && templates.length > 0 && (
                    <div className="space-y-3 max-w-3xl mx-auto">
                        {templates.map((tpl) => (
                            // ── Card: <article> avoids button-in-button ──────────────────────
                            <article
                                key={tpl.id}
                                className="group bg-white border border-gray-100 rounded-2xl p-5 hover:border-[#006dd8]/30 hover:shadow-md transition-all focus-within:ring-2 focus-within:ring-[#006dd8]/20"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    {/* Clickable info area */}
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => onLoad(tpl)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onLoad(tpl); }}
                                        className="flex items-start space-x-4 min-w-0 flex-1 cursor-pointer"
                                        aria-label={`Open template: ${tpl.name}`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-[#006dd8]/10 flex items-center justify-center shrink-0">
                                            <Mail size={18} className="text-[#006dd8]" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-[#001033] group-hover:text-[#006dd8] transition-colors truncate">
                                                {tpl.name}
                                            </p>
                                            <div className="flex items-center space-x-3 mt-1">
                                                <span className="flex items-center space-x-1 text-[10px] text-[#737477]">
                                                    <Calendar size={10} />
                                                    <span>{fmtDate(tpl.created_at)}</span>
                                                </span>
                                                <span className="flex items-center space-x-1 text-[10px] text-[#737477]">
                                                    <Clock size={10} />
                                                    <span>Updated {fmtTime(tpl.updated_at)}</span>
                                                </span>
                                            </div>
                                            <p className="hidden lg:block text-[10px] font-mono text-[#737477] truncate opacity-60 group-hover:opacity-100 transition-opacity mt-2 max-w-[420px]">
                                                {tpl.mjml.slice(0, 90)}…
                                            </p>
                                        </div>
                                    </div>

                                    {/* Delete button — real <button>, sibling not child of another button */}
                                    <button
                                        onClick={() => handleDelete(tpl.id)}
                                        disabled={deleting === tpl.id}
                                        aria-label={`Delete template: ${tpl.name}`}
                                        className="shrink-0 p-2 rounded-lg text-[#737477] hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {deleting === tpl.id
                                            ? <Loader2 size={15} className="animate-spin" />
                                            : <Trash2 size={15} />
                                        }
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TemplatesPanel;
