import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Loader2 } from 'lucide-react';

interface SaveAsModalProps {
    defaultName?: string;
    isSaving: boolean;
    onConfirm: (name: string) => void;
    onClose: () => void;
}

const SaveAsModal: React.FC<SaveAsModalProps> = ({ defaultName = '', isSaving, onConfirm, onClose }) => {
    const [name, setName] = useState(defaultName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(name.trim());
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
            aria-label="Save as new template"
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-[#001033] rounded-xl flex items-center justify-center">
                            <Copy size={14} className="text-white" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-[#001033]">Save as New Template</h2>
                            <p className="text-[10px] text-[#737477] mt-0.5">Creates a separate copy with its own history.</p>
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label htmlFor="save-as-name" className="block text-[10px] font-bold text-[#737477] uppercase tracking-widest mb-2">
                            Template name
                        </label>
                        <input
                            ref={inputRef}
                            id="save-as-name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="My new template…"
                            className="w-full px-4 py-3 bg-[#F9FAFB] border border-gray-200 rounded-xl text-sm font-medium text-[#001033] focus:ring-2 focus:ring-[#006dd8]/20 focus:border-[#006dd8] outline-none transition-all"
                        />
                    </div>

                    <div className="flex space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-[#737477] hover:bg-gray-50 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all ${isSaving ? 'bg-[#001033]/40 cursor-not-allowed' : 'bg-[#001033] hover:bg-[#002266] cursor-pointer shadow-sm'
                                }`}
                        >
                            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                            <span>{isSaving ? 'Saving…' : 'Create copy'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SaveAsModal;
