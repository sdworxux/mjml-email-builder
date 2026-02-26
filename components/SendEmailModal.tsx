import React, { useState } from 'react';
import { X, Send, Loader2, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';

interface SendEmailModalProps {
    /** Already-compiled HTML string ready to send */
    html: string;
    /** Default subject line (campaign name) */
    defaultSubject: string;
    onClose: () => void;
}

type SendState = 'idle' | 'sending' | 'success' | 'error';

const SUPABASE_URL = 'https://qmgyzbrykzbyyqddyyrd.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtZ3l6YnJ5a3pieXlxZGR5eXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0Mjk4NzUsImV4cCI6MjA4NzAwNTg3NX0.aH4766y6l0iJtONRz3IyjKiO5xOWlNymSVbHfJ362gU';

const SendEmailModal: React.FC<SendEmailModalProps> = ({ html, defaultSubject, onClose }) => {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState(defaultSubject);
    const [fromName, setFromName] = useState('');
    const [state, setState] = useState<SendState>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const isValid = to.trim().includes('@') && subject.trim().length > 0;

    const handleSend = async () => {
        if (!isValid) return;
        setState('sending');
        setErrorMsg('');

        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/send-campaign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ to: to.trim(), subject: subject.trim(), html, fromName }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error ?? `Server responded with ${res.status}`);
            }

            setState('success');
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : String(err));
            setState('error');
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Send campaign email"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[#001033]/40 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal card */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="px-7 pt-7 pb-5 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Mail size={15} className="text-amber-600" />
                            </div>
                            <h2 className="text-base font-black text-[#001033]">Send Campaign</h2>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-[#737477] transition-colors cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <p className="text-[11px] text-[#737477] font-medium">
                        Send the compiled email to any inbox via Resend.
                    </p>
                </div>

                {state === 'success' ? (
                    /* ── Success state ── */
                    <div className="px-7 py-12 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-5">
                            <CheckCircle2 size={32} className="text-green-500" />
                        </div>
                        <h3 className="text-lg font-black text-[#001033] mb-1">Email sent!</h3>
                        <p className="text-sm text-[#737477] mb-6">
                            Your campaign is on its way to <span className="font-bold text-[#001033]">{to}</span>.
                        </p>
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-[#001033] text-white font-bold text-sm rounded-xl hover:bg-[#002266] transition-colors cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    /* ── Form ── */
                    <div className="px-7 py-6 space-y-5">

                        {/* To */}
                        <div>
                            <label htmlFor="send-to" className="block text-[10px] font-bold text-[#737477] uppercase tracking-widest mb-1.5">
                                Recipient Email *
                            </label>
                            <input
                                id="send-to"
                                type="email"
                                value={to}
                                onChange={e => setTo(e.target.value)}
                                placeholder="recipient@example.com"
                                disabled={state === 'sending'}
                                className="w-full px-4 py-2.5 bg-[#F4F5F8] border border-transparent hover:border-gray-200 focus:border-[#006dd8] focus:bg-white focus:ring-2 focus:ring-[#006dd8]/20 rounded-xl text-sm font-medium text-[#001033] placeholder-[#B0B2B5] outline-none transition-all disabled:opacity-50"
                            />
                        </div>

                        {/* Subject */}
                        <div>
                            <label htmlFor="send-subject" className="block text-[10px] font-bold text-[#737477] uppercase tracking-widest mb-1.5">
                                Subject Line *
                            </label>
                            <input
                                id="send-subject"
                                type="text"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                placeholder="Your email subject…"
                                disabled={state === 'sending'}
                                className="w-full px-4 py-2.5 bg-[#F4F5F8] border border-transparent hover:border-gray-200 focus:border-[#006dd8] focus:bg-white focus:ring-2 focus:ring-[#006dd8]/20 rounded-xl text-sm font-medium text-[#001033] placeholder-[#B0B2B5] outline-none transition-all disabled:opacity-50"
                            />
                        </div>

                        {/* From name (optional) */}
                        <div>
                            <label htmlFor="send-from-name" className="block text-[10px] font-bold text-[#737477] uppercase tracking-widest mb-1.5">
                                Sender Name <span className="normal-case font-normal">(optional)</span>
                            </label>
                            <input
                                id="send-from-name"
                                type="text"
                                value={fromName}
                                onChange={e => setFromName(e.target.value)}
                                placeholder="e.g. Acme Marketing"
                                disabled={state === 'sending'}
                                className="w-full px-4 py-2.5 bg-[#F4F5F8] border border-transparent hover:border-gray-200 focus:border-[#006dd8] focus:bg-white focus:ring-2 focus:ring-[#006dd8]/20 rounded-xl text-sm font-medium text-[#001033] placeholder-[#B0B2B5] outline-none transition-all disabled:opacity-50"
                            />
                        </div>

                        {/* Error banner */}
                        {state === 'error' && (
                            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl">
                                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] font-medium text-red-700 leading-relaxed">{errorMsg}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-[#737477] hover:text-[#001033] hover:border-gray-300 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                id="send-email-confirm"
                                onClick={handleSend}
                                disabled={!isValid || state === 'sending'}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${!isValid || state === 'sending'
                                        ? 'bg-amber-200 text-amber-400 cursor-not-allowed'
                                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow-md cursor-pointer active:scale-95'
                                    }`}
                            >
                                {state === 'sending' ? (
                                    <><Loader2 size={14} className="animate-spin" /><span>Sending…</span></>
                                ) : (
                                    <><Send size={14} /><span>Send Email</span></>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SendEmailModal;
