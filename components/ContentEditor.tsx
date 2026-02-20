import React, { useRef, useEffect, useCallback } from 'react';
import { Bold, Italic, Underline, Link2, List, ListOrdered, Code, Eye } from 'lucide-react';

interface ContentEditorProps {
    /** Current HTML (or plain text) value */
    value: string;
    onChange: (html: string) => void;
    /** 'wysiwyg' = rich text toolbar + contenteditable
     *  'code'    = dark textarea (for mj-raw, mj-table, mj-style …) */
    mode: 'wysiwyg' | 'code';
    placeholder?: string;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
    value,
    onChange,
    mode,
    placeholder = 'Enter content…',
}) => {
    const divRef = useRef<HTMLDivElement>(null);
    // Track the last value we set so we don't reset cursor position needlessly
    const lastVal = useRef(value);
    const [htmlView, setHtmlView] = React.useState(false);

    // Initialise / sync the contenteditable when switching modes
    useEffect(() => {
        if (mode === 'wysiwyg' && !htmlView && divRef.current) {
            // Only write to the DOM when the value changed externally
            if (value !== lastVal.current) {
                divRef.current.innerHTML = value ?? '';
                lastVal.current = value;
            }
        }
    }, [value, mode, htmlView]);

    // On mount: set initial innerHTML
    useEffect(() => {
        if (divRef.current) {
            divRef.current.innerHTML = value ?? '';
            lastVal.current = value;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-apply innerHTML when toggling back to WYSIWYG view
    const prevHtmlView = useRef(htmlView);
    useEffect(() => {
        if (prevHtmlView.current && !htmlView && divRef.current) {
            divRef.current.innerHTML = value ?? '';
            lastVal.current = value;
        }
        prevHtmlView.current = htmlView;
    }, [htmlView, value]);

    const handleInput = useCallback(() => {
        if (divRef.current) {
            const html = divRef.current.innerHTML;
            lastVal.current = html;
            onChange(html);
        }
    }, [onChange]);

    /**
     * execCommand is deprecated in the spec but is still the most reliable
     * cross-browser way to perform inline rich-text editing in a contenteditable.
     * We use onMouseDown + e.preventDefault() to keep focus inside the editor.
     */
    const exec = (cmd: string, val?: string) => {
        divRef.current?.focus();
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        document.execCommand(cmd, false, val);
        handleInput();
    };

    const insertLink = () => {
        const url = window.prompt('Enter URL:', 'https://');
        if (url) exec('createLink', url);
    };

    /* ── Toolbar button ──────────────────────────────────────────────────── */
    const Btn = ({
        title, children, cmd, val,
        onClick,
    }: {
        title: string;
        children: React.ReactNode;
        cmd?: string;
        val?: string;
        onClick?: () => void;
    }) => (
        <button
            type="button"
            title={title}
            aria-label={title}
            onMouseDown={e => {
                e.preventDefault(); // keep editor focused
                if (onClick) onClick();
                else if (cmd) exec(cmd, val);
            }}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors"
        >
            {children}
        </button>
    );

    /* ── Code (raw HTML) mode ─────────────────────────────────────────────── */
    if (mode === 'code') {
        return (
            <div className="rounded-xl overflow-hidden border border-gray-200">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700">
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">HTML</span>
                    <Code size={12} className="text-gray-500" aria-hidden="true" />
                </div>
                <textarea
                    value={value ?? ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    spellCheck={false}
                    className="w-full font-mono text-[11px] leading-relaxed p-3 bg-gray-900 text-green-300 resize-none outline-none min-h-[120px] placeholder:text-gray-600"
                    style={{ tabSize: 2 }}
                />
            </div>
        );
    }

    /* ── WYSIWYG mode ────────────────────────────────────────────────────── */
    return (
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
            {/* Toolbar */}
            {!htmlView && (
                <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200 flex-wrap">
                    <Btn title="Bold" cmd="bold"><Bold size={13} /></Btn>
                    <Btn title="Italic" cmd="italic"><Italic size={13} /></Btn>
                    <Btn title="Underline" cmd="underline"><Underline size={13} /></Btn>
                    <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden="true" />
                    <Btn title="Bullet list" cmd="insertUnorderedList"><List size={13} /></Btn>
                    <Btn title="Numbered list" cmd="insertOrderedList"><ListOrdered size={13} /></Btn>
                    <div className="w-px h-4 bg-gray-200 mx-1" aria-hidden="true" />
                    <Btn title="Insert link" onClick={insertLink}><Link2 size={13} /></Btn>

                    <div className="flex-1" />
                    {/* HTML source toggle */}
                    <button
                        type="button"
                        title="View/edit HTML source"
                        aria-label="Toggle HTML source view"
                        onClick={() => setHtmlView(true)}
                        className="px-2 py-1 rounded text-[10px] font-mono font-bold text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                    >
                        {'</>'}
                    </button>
                </div>
            )}

            {/* HTML source view */}
            {htmlView ? (
                <div className="relative">
                    <textarea
                        value={value ?? ''}
                        onChange={e => { lastVal.current = e.target.value; onChange(e.target.value); }}
                        spellCheck={false}
                        className="w-full font-mono text-[11px] leading-relaxed p-3 bg-gray-900 text-green-300 resize-none outline-none min-h-[120px]"
                        style={{ tabSize: 2 }}
                    />
                    <button
                        type="button"
                        title="Back to visual editor"
                        aria-label="Back to visual editor"
                        onClick={() => setHtmlView(false)}
                        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded text-[10px] font-bold transition-colors"
                    >
                        <Eye size={11} />
                        <span>Visual</span>
                    </button>
                </div>
            ) : (
                /* Rich-text editor */
                <div
                    ref={divRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onBlur={handleInput}
                    data-placeholder={placeholder}
                    aria-label="Rich text editor"
                    aria-multiline="true"
                    role="textbox"
                    className={[
                        'min-h-[100px] max-h-[320px] overflow-y-auto p-3',
                        'text-sm text-gray-800 outline-none',
                        'focus:bg-blue-50/20 transition-colors',
                        'prose prose-sm max-w-none',
                        // Placeholder via CSS attr()
                        'empty:before:content-[attr(data-placeholder)]',
                        'empty:before:text-gray-400 empty:before:pointer-events-none',
                    ].join(' ')}
                    style={{ lineHeight: 1.65 }}
                />
            )}
        </div>
    );
};

export default ContentEditor;
