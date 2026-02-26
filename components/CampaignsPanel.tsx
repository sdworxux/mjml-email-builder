import React, { useEffect, useState, useCallback } from 'react';
import { supabase, DBCampaign, DBTemplate } from '../lib/supabase';
import { MJElement } from '../types';
import {
    Plus, Loader2, AlertTriangle, Trash2, Mail,
    LayoutTemplate, ChevronRight, RefreshCw,
} from 'lucide-react';

interface CampaignsPanelProps {
    /** Called when the user opens a campaign for editing */
    onLoad: (elements: MJElement[], campaignId: string, campaignName: string) => void;
    /** Called when the user wants to create a new campaign from a master template */
    onNewFromTemplate: () => void;
}

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const CampaignsPanel: React.FC<CampaignsPanelProps> = ({ onLoad, onNewFromTemplate }) => {
    const [campaigns, setCampaigns] = useState<DBCampaign[]>([]);
    const [templates, setTemplates] = useState<DBTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [{ data: c, error: ce }, { data: t, error: te }] = await Promise.all([
                supabase.from('campaigns').select('*').order('updated_at', { ascending: false }),
                supabase.from('templates').select('id,name'),
            ]);
            if (ce) throw ce;
            if (te) throw te;
            setCampaigns((c as DBCampaign[]) ?? []);
            setTemplates((t as DBTemplate[]) ?? []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load campaigns');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this campaign? This cannot be undone.')) return;
        setDeleting(id);
        await supabase.from('campaigns').delete().eq('id', id);
        setCampaigns(prev => prev.filter(c => c.id !== id));
        setDeleting(null);
    };

    const masterName = (id: string | null) =>
        id ? (templates.find(t => t.id === id)?.name ?? 'Unknown template') : 'No template';

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#006dd8]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
                <AlertTriangle size={24} className="text-red-400" />
                <p className="text-sm text-red-600 font-bold">{error}</p>
                <button onClick={load} className="flex items-center gap-2 text-xs text-[#006dd8] font-bold cursor-pointer hover:underline">
                    <RefreshCw size={13} /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-black text-[#001033]">My Campaigns</h2>
                    <p className="text-xs text-[#737477] mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        aria-label="Refresh campaigns"
                        className="p-2 rounded-lg text-[#737477] hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={onNewFromTemplate}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#001033] text-white text-xs font-bold rounded-lg hover:bg-[#002266] transition-colors cursor-pointer shadow-sm"
                    >
                        <Plus size={13} />
                        New Campaign
                    </button>
                </div>
            </div>

            {campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl py-20 text-center">
                    <div className="w-16 h-16 bg-[#F4F5F8] rounded-2xl flex items-center justify-center mb-5">
                        <Mail size={28} className="text-[#001033]" />
                    </div>
                    <h3 className="text-sm font-bold text-[#001033] mb-1">No campaigns yet</h3>
                    <p className="text-xs text-[#737477] max-w-[200px] leading-relaxed mb-4">
                        Create a campaign from a master template to personalise and send.
                    </p>
                    <button
                        onClick={onNewFromTemplate}
                        className="flex items-center gap-2 px-4 py-2 bg-[#001033] text-white rounded-xl text-xs font-bold hover:bg-[#002266] transition-colors cursor-pointer"
                    >
                        <Plus size={13} /> New Campaign
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {campaigns.map(campaign => (
                        <div
                            key={campaign.id}
                            className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all group"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-[#001033] truncate">{campaign.name}</h3>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <LayoutTemplate size={10} className="text-[#737477] shrink-0" />
                                        <span className="text-[10px] text-[#737477] truncate">
                                            {masterName(campaign.template_id)}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-[#B0B2B5] mt-1.5">
                                        Updated {fmtDate(campaign.updated_at)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => handleDelete(campaign.id)}
                                        disabled={deleting === campaign.id}
                                        aria-label="Delete campaign"
                                        className="p-1.5 rounded-lg text-[#737477] hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                    >
                                        {deleting === campaign.id
                                            ? <Loader2 size={13} className="animate-spin" />
                                            : <Trash2 size={13} />}
                                    </button>
                                    <button
                                        onClick={() => onLoad(campaign.elements as MJElement[], campaign.id, campaign.name)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-[#001033] text-white text-[10px] font-bold rounded-lg hover:bg-[#002266] transition-colors cursor-pointer"
                                    >
                                        Open <ChevronRight size={11} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CampaignsPanel;
