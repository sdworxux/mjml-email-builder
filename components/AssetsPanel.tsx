import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, ImageIcon, Trash2, Loader2, AlertTriangle, RefreshCw, Plus } from 'lucide-react';

export interface DBAsset {
    id: string;
    name: string;
    url: string;
    mime_type: string | null;
    size: number | null;
    created_at: string;
}

interface AssetsPanelProps {
    /** Called when an asset is selected (to paste URL into PropertyEditor) */
    onSelect?: (asset: DBAsset) => void;
    /** When true, render compact picker mode (used inside PropertyEditor) */
    pickerMode?: boolean;
}

const AssetsPanel: React.FC<AssetsPanelProps> = ({ onSelect, pickerMode = false }) => {
    const [assets, setAssets] = useState<DBAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchAssets = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error: err } = await supabase
            .from('assets')
            .select('*')
            .order('created_at', { ascending: false });
        if (err) setError(err.message);
        else setAssets((data as DBAsset[]) ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAssets(); }, [fetchAssets]);

    // ── Upload ───────────────────────────────────────────────────────────────
    const uploadFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Only image files are supported.');
            return;
        }
        setUploading(true);
        try {
            const path = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;

            // 1. Upload to Supabase Storage
            const { error: uploadErr } = await supabase.storage
                .from('assets')
                .upload(path, file, { cacheControl: '3600', upsert: false });
            if (uploadErr) throw uploadErr;

            // 2. Get public URL
            const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path);
            const url = urlData.publicUrl;

            // 3. Insert metadata row
            const { data: row, error: insertErr } = await supabase
                .from('assets')
                .insert({ name: file.name, url, mime_type: file.type, size: file.size })
                .select()
                .single();
            if (insertErr) throw insertErr;

            setAssets(prev => [row as DBAsset, ...prev]);
        } catch (err) {
            alert(`Upload failed: ${(err as Error).message}`);
        } finally {
            setUploading(false);
        }
    }, []);

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        Array.from(files).forEach(uploadFile);
    };

    // ── Drag & drop ──────────────────────────────────────────────────────────
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const onDragLeave = () => setIsDragOver(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    // ── Delete ───────────────────────────────────────────────────────────────
    const handleDelete = async (asset: DBAsset) => {
        if (!confirm(`Delete "${asset.name}"?`)) return;
        setDeleting(asset.id);
        try {
            // Remove from storage (path = everything after /object/public/assets/)
            const path = new URL(asset.url).pathname.split('/assets/')[1];
            await supabase.storage.from('assets').remove([path]);
            const { error: dbErr } = await supabase.from('assets').delete().eq('id', asset.id);
            if (dbErr) throw dbErr;
            setAssets(prev => prev.filter(a => a.id !== asset.id));
        } catch (err) {
            alert(`Delete failed: ${(err as Error).message}`);
        } finally {
            setDeleting(null);
        }
    };

    const fmtSize = (bytes: number | null) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // ── Picker mode (compact, used inside PropertyEditor) ─────────────────
    if (pickerMode) {
        return (
            <div className="w-full">
                {loading && <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[#006dd8]" /></div>}
                {!loading && assets.length === 0 && (
                    <p className="text-xs text-[#737477] text-center py-4">No assets yet. Upload images via the Assets tab.</p>
                )}
                {!loading && assets.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                        {assets.map(a => (
                            <button
                                key={a.id}
                                onClick={() => onSelect?.(a)}
                                aria-label={`Select asset: ${a.name}`}
                                className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-[#006dd8] transition-all cursor-pointer focus:outline-none focus:border-[#006dd8]"
                            >
                                <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                    <span className="text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 px-1 text-center leading-tight">{a.name}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ── Full panel mode ──────────────────────────────────────────────────────
    return (
        <div className="flex-1 overflow-hidden flex flex-col bg-[#FBFBFB]">
            {/* Header */}
            <div className="px-8 py-5 border-b border-[#E2E8F0] bg-white flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-base font-bold text-[#001033]">Assets</h2>
                    <p className="text-xs text-[#737477] mt-0.5">Upload images and use them in your email templates.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={fetchAssets} disabled={loading} aria-label="Refresh assets"
                        className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white text-[#737477] hover:text-[#001033] hover:border-gray-300 transition-all cursor-pointer disabled:opacity-50">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        aria-label="Upload image"
                        className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#001033] text-white hover:bg-[#002266] transition-all cursor-pointer disabled:opacity-50">
                        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        <span>{uploading ? 'Uploading…' : 'Add Asset'}</span>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={e => handleFiles(e.target.files)} />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
                {/* Drop zone */}
                <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    aria-label="Drag and drop images here or click to upload"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                    className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragOver
                            ? 'border-[#006dd8] bg-[#006dd8]/5'
                            : 'border-gray-200 bg-white hover:border-[#006dd8]/50 hover:bg-gray-50'
                        }`}
                >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${isDragOver ? 'bg-[#006dd8]/10 text-[#006dd8]' : 'bg-gray-100 text-[#737477]'}`}>
                        {uploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                    </div>
                    <p className="text-sm font-bold text-[#001033] mb-1">
                        {uploading ? 'Uploading…' : 'Drop images here'}
                    </p>
                    <p className="text-xs text-[#737477]">or click to browse (JPG, PNG, GIF, WebP, SVG · max 10 MB)</p>
                </div>

                {/* Asset grid */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 size={28} className="animate-spin text-[#006dd8] mb-3" />
                        <p className="text-xs text-[#737477] font-medium">Loading assets…</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-400 mb-4">
                            <AlertTriangle size={22} />
                        </div>
                        <h3 className="text-sm font-bold text-red-600 mb-1">Could not load assets</h3>
                        <p className="text-xs text-[#737477] mb-4">{error}</p>
                        <button onClick={fetchAssets}
                            className="px-4 py-2 bg-[#001033] text-white text-xs font-bold rounded-lg hover:bg-[#002266] cursor-pointer">
                            Try again
                        </button>
                    </div>
                )}

                {!loading && !error && assets.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#737477] mb-6">
                            <ImageIcon size={28} />
                        </div>
                        <h3 className="text-sm font-bold text-[#001033] mb-2">No assets yet</h3>
                        <p className="text-xs text-[#737477] max-w-[220px] leading-relaxed">
                            Upload images using the drop zone above or the <strong>Add Asset</strong> button.
                        </p>
                    </div>
                )}

                {!loading && !error && assets.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {assets.map(asset => (
                            <article key={asset.id} className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-[#006dd8]/30 hover:shadow-md transition-all">
                                {/* Image preview */}
                                <div className="aspect-square bg-gray-50 overflow-hidden">
                                    <img
                                        src={asset.url}
                                        alt={asset.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        loading="lazy"
                                    />
                                </div>
                                {/* Meta + actions */}
                                <div className="p-3">
                                    <p className="text-[11px] font-bold text-[#001033] truncate">{asset.name}</p>
                                    {asset.size && (
                                        <p className="text-[10px] text-[#737477] mt-0.5">{fmtSize(asset.size)}</p>
                                    )}
                                    <div className="flex items-center justify-between mt-2">
                                        {/* Copy URL */}
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(asset.url); }}
                                            aria-label={`Copy URL of ${asset.name}`}
                                            className="text-[10px] text-[#006dd8] font-bold hover:underline cursor-pointer"
                                        >
                                            Copy URL
                                        </button>
                                        {/* Delete */}
                                        <button
                                            onClick={() => handleDelete(asset)}
                                            disabled={deleting === asset.id}
                                            aria-label={`Delete ${asset.name}`}
                                            className="p-1 rounded-lg text-[#737477] hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {deleting === asset.id
                                                ? <Loader2 size={13} className="animate-spin" />
                                                : <Trash2 size={13} />
                                            }
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetsPanel;
