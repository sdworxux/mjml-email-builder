import React, { useEffect, useState, useCallback } from 'react';
import { supabase, DBTemplateHistory } from '../lib/supabase';
import { MJElement } from '../types';
import { X, Clock, RotateCcw, Loader2, AlertTriangle, History } from 'lucide-react';

interface RestoreVersionModalProps {
    templateId: string;
    onRestore: (snapshot: DBTemplateHistory) => void;
    onClose: () => void;
}

const RestoreVersionModal: React.FC<RestoreVersionModalProps> = ({ templateId, onRestore, onClose }) => {
    const [versions, setVersions] = useState<DBTemplateHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchVersions = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: err } = await supabase
            .from('template_history')
            .select('*')
            .eq('template_id', templateId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (err) setError(err.message);
        else setVersions((data as DBTemplateHistory[]) ?? []);
        setLoading(false);
    }, [templateId]);

    useEffect(() => { fetchVersions(); }, [fetchVersions]);

    const fmt = (iso: string) =>
        new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
            aria-label="Restore previous version"
        >
            {/* Panel */}
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-[#001033] rounded-xl flex items-center justify-center">
                            <History size={15} className="text-white" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-[#001033]">Restore Previous Version</h2>
                            <p className="text-[10px] text-[#737477] mt-0.5">Click a version to load it onto the canvas.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                    >
                        <X size={16} className="text-[#737477]" aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-2">

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-[#006dd8] mb-3" />
                            <p className="text-xs text-[#737477]">Loading versions…</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <AlertTriangle size={24} className="text-red-400 mb-3" />
                            <p className="text-xs text-red-600 font-bold mb-1">Could not load versions</p>
                            <p className="text-xs text-[#737477]">{error}</p>
                        </div>
                    )}

                    {!loading && !error && versions.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <History size={32} className="text-gray-200 mb-4" />
                            <p className="text-sm font-bold text-[#001033] mb-1">No history yet</p>
                            <p className="text-xs text-[#737477] max-w-[220px] leading-relaxed">
                                Every time you save, a snapshot is stored here automatically.
                            </p>
                        </div>
                    )}

                    {!loading && !error && versions.map((v, idx) => (
                        <button
                            key={v.id}
                            onClick={() => onRestore(v)}
                            className="w-full text-left group bg-[#FBFBFB] hover:bg-white border border-gray-100 hover:border-[#006dd8]/30 hover:shadow-md rounded-2xl p-4 transition-all cursor-pointer"
                            aria-label={`Restore version saved on ${fmt(v.created_at)}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center space-x-3 min-w-0">
                                    <div className="w-8 h-8 bg-[#006dd8]/10 rounded-xl flex items-center justify-center shrink-0">
                                        <Clock size={14} className="text-[#006dd8]" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-[#001033] truncate group-hover:text-[#006dd8] transition-colors">
                                            {v.name}
                                        </p>
                                        <p className="text-[10px] text-[#737477] mt-0.5 flex items-center space-x-1">
                                            <span>{fmt(v.created_at)}</span>
                                            {idx === 0 && (
                                                <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-bold uppercase tracking-wide">
                                                    Latest
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <RotateCcw
                                    size={14}
                                    className="shrink-0 text-gray-300 group-hover:text-[#006dd8] transition-colors"
                                    aria-hidden="true"
                                />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RestoreVersionModal;
