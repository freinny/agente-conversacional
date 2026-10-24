import React, { useState, useEffect } from 'react';
import type { EvidenceItem, TreeNode } from '@repo/shared';
import { Table, Info, Cpu, Layers, Terminal, ChevronRight, CheckCircle2, AlertCircle, Clock, FileText, Mail, Send } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Legend
} from 'recharts';

interface EvidencePanelProps {
    evidence: EvidenceItem[];
    assistantText: string;
    isIdle: boolean;
}

const TreeVisualizer: React.FC<{ node: TreeNode; level?: number }> = ({ node, level = 0 }) => {
    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'matched': return 'text-accent-emerald bg-accent-emerald/10 border-accent-emerald/20';
            case 'exception': return 'text-accent-rose bg-accent-rose/10 border-accent-rose/20';
            case 'pending': return 'text-accent-amber bg-accent-amber/10 border-accent-amber/20';
            default: return 'text-white/40 bg-white/5 border-white/10';
        }
    };

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'matched': return <CheckCircle2 size={12} />;
            case 'exception': return <AlertCircle size={12} />;
            case 'pending': return <Clock size={12} />;
            default: return null;
        }
    };

    return (
        <div className="relative">
            {/* Connecting lines */}
            {level > 0 && (
                <div className="absolute -left-6 top-0 bottom-0 w-px bg-white/10">
                    <div className="absolute top-4 left-0 w-4 h-px bg-white/10" />
                </div>
            )}

            <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 hover:bg-white/[0.05] shadow-lg mb-4 ${level === 0 ? 'bg-white/[0.07] border-white/20' : 'bg-white/[0.02] border-white/5'}`}>
                <div className={`p-2 rounded-lg ${level === 0 ? 'bg-accent-blue/20 text-accent-blue' : 'bg-white/5 text-white/40'}`}>
                    {level === 0 ? <Layers size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-current opacity-20" />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className={`font-bold tracking-tight truncate ${level === 0 ? 'text-sm text-white' : 'text-[12px] text-white/80'}`}>
                            {node.name}
                        </h4>
                        {node.status && node.status !== 'neutral' && (
                            <div className={`px-2 py-0.5 rounded-full flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest border ${getStatusColor(node.status)}`}>
                                {getStatusIcon(node.status)}
                                {node.status}
                            </div>
                        )}
                    </div>
                    {node.description && <p className="text-[10px] text-white/40 line-clamp-1 mb-2 font-medium">{node.description}</p>}
                    {node.value && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#00d2ff]/10 text-[#00d2ff] text-[10px] font-bold">
                            <ChevronRight size={10} className="opacity-50" />
                            {node.value}
                        </div>
                    )}
                </div>
            </div>

            {node.children && node.children.length > 0 && (
                <div className="ml-10">
                    {node.children.map((child, i) => (
                        <TreeVisualizer key={i} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const MailLogo: React.FC<{ isSending: boolean }> = ({ isSending }) => {
    return (
        <div className="relative w-12 h-12 flex items-center justify-center">
            {/* Background Glow */}
            <div className={`absolute inset-0 bg-accent-blue/20 rounded-2xl blur-xl transition-all duration-700 ${isSending ? 'scale-150 opacity-0' : 'animate-pulse scale-100'}`} />

            {/* Mail Icon */}
            <div className={`relative z-10 transition-all duration-700 ${isSending ? 'translate-x-32 -translate-y-32 scale-0 opacity-0 rotate-12' : 'scale-100 opacity-100'}`}>
                <div className="p-3 bg-gradient-to-br from-accent-blue to-accent-blue-dark rounded-xl shadow-[0_0_20px_rgba(0,210,255,0.4)] border border-white/20">
                    <Mail size={24} className="text-white" />
                </div>
            </div>

            {/* Path lines (only during sending) */}
            {isSending && (
                <div className="absolute inset-0 flex items-center justify-center opacity-40">
                    <div className="w-64 h-px bg-gradient-to-r from-accent-blue to-transparent absolute rotate-[-45deg] animate-in slide-in-from-left duration-1000" />
                </div>
            )}
        </div>
    );
};

const EmailDraftVisualizer: React.FC<{ draft: NonNullable<EvidenceItem['emailDraft']> }> = ({ draft }) => {
    const [to, setTo] = useState(draft.to);
    const [subject, setSubject] = useState(draft.subject);
    const [body, setBody] = useState(draft.body);
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);

    // API URL constant
    const API_URL = 'http://localhost:8080';

    useEffect(() => {
        setTo(draft.to);
        setSubject(draft.subject);
        setBody(draft.body);
    }, [draft.to, draft.subject, draft.body]);

    const handleSync = async (updatedFields: { to?: string, subject?: string, body?: string }) => {
        const newTo = updatedFields.to ?? to;
        const newSubject = updatedFields.subject ?? subject;
        const newBody = updatedFields.body ?? body;

        setTo(newTo);
        setSubject(newSubject);
        setBody(newBody);

        try {
            await fetch(`${API_URL}/api/email/update-draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: newTo, subject: newSubject, body: newBody })
            });
        } catch (err) {
            console.error('Failed to sync draft:', err);
        }
    };

    const handleSend = async () => {
        setIsSending(true);
        // Add a small delay for the "flying" animation to be visible
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            const resp = await fetch(`${API_URL}/api/email/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, subject, body })
            });
            if (resp.ok) {
                setIsSent(true);
            }
        } catch (err) {
            console.error('Failed to send email:', err);
        } finally {
            setIsSending(false);
        }
    };

    if (isSent) {
        return (
            <div className="bg-accent-emerald/10 border border-accent-emerald/20 rounded-2xl p-12 flex flex-col items-center justify-center gap-6 animate-in zoom-in-95 duration-500 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-emerald/5 via-transparent to-transparent" />
                <div className="w-20 h-20 bg-accent-emerald/20 rounded-full flex items-center justify-center text-accent-emerald shadow-[0_0_50px_rgba(52,211,153,0.4)] relative z-10 animate-in zoom-in-50 duration-700 ease-out">
                    <CheckCircle2 size={40} className="animate-in fade-in-0 duration-1000" />
                </div>
                <div className="text-center relative z-10">
                    <h4 className="text-2xl font-bold text-white mb-2 tracking-tight">¡Correo Enviado!</h4>
                    <p className="text-white/50 text-sm max-w-xs mx-auto">El mensaje ha sido entregado exitosamente a <strong>{to}</strong>.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-500">
            <div className="bg-white/[0.05] px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <MailLogo isSending={isSending} />
                    <div>
                        <span className="text-[11px] font-light tracking-[0.05em] text-white/70 block">Operación mail</span>
                        <span className="text-[9px] font-extralight text-accent-blue tracking-wider">Borrador inteligente</span>
                    </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-500 ${isSending ? 'bg-accent-blue/20 border-accent-blue/30 scale-105' : 'bg-accent-amber/10 border-accent-amber/20'}`}>
                    <Clock size={12} className={`transition-colors duration-500 ${isSending ? 'text-accent-blue animate-spin' : 'text-accent-amber'}`} />
                    <span className={`text-[9px] font-light tracking-tight transition-colors duration-500 ${isSending ? 'text-accent-blue' : 'text-accent-amber'}`}>
                        {isSending ? 'Enviando...' : 'Pendiente de envío'}
                    </span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-4 group/field bg-white/[0.02] p-3 rounded-xl border border-transparent focus-within:border-white/10 transition-all duration-300">
                        <span className="text-[9px] font-light text-white/30 w-12 shrink-0">Para:</span>
                        <input
                            className="bg-transparent border-none text-sm font-bold text-accent-blue focus:outline-none w-full"
                            value={to}
                            onChange={(e) => handleSync({ to: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center gap-4 group/field bg-white/[0.02] p-3 rounded-xl border border-transparent focus-within:border-white/10 transition-all duration-300">
                        <span className="text-[9px] font-light text-white/30 w-12 shrink-0">Asunto:</span>
                        <input
                            className="bg-transparent border-none text-sm font-medium text-white/90 focus:outline-none w-full"
                            value={subject}
                            onChange={(e) => handleSync({ subject: e.target.value })}
                        />
                    </div>
                </div>

                <div className="bg-black/20 rounded-xl p-6 border border-white/5 group focus-within:border-accent-blue/30 transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue/5 blur-[50px] -mr-16 -mt-16 pointer-events-none" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <span className="text-[8px] font-light text-white/20 tracking-[0.05em]">Cuerpo del mensaje</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] font-light text-white/10 italic">Editor en tiempo real</span>
                            <FileText size={10} className="text-white/10" />
                        </div>
                    </div>
                    <textarea
                        className="w-full bg-transparent border-none text-white/80 text-[14px] leading-relaxed font-serif focus:outline-none min-h-[180px] resize-none custom-scrollbar relative z-10"
                        value={body}
                        onChange={(e) => handleSync({ body: e.target.value })}
                        placeholder="Escribe el contenido del correo..."
                    />
                </div>

                <div className="flex items-center gap-4 pt-2">
                    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex-1 flex items-start gap-4 hover:bg-white/[0.05] transition-colors duration-300">
                        <div className="p-2 bg-accent-blue/20 rounded-lg text-accent-blue shrink-0">
                            <Info size={16} />
                        </div>
                        <p className="text-[11px] text-white/40 leading-relaxed">
                            Amalia ha redactado este borrador siguiendo tus instrucciones. Puedes ajustarlo libremente y confirmar con <strong>\"Envíalo\"</strong> o el botón de acción.
                        </p>
                    </div>
                    <button
                        onClick={handleSend}
                        disabled={isSending}
                        className={`flex items-center gap-3 px-8 py-4 rounded-xl font-light text-[11px] tracking-[0.2em] transition-all duration-500 shadow-2xl relative overflow-hidden ${isSending
                            ? 'bg-white/5 text-white/20 cursor-wait ring-1 ring-white/10'
                            : 'bg-accent-blue text-white hover:bg-accent-blue-dark hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,210,255,0.4)]'
                            }`}
                    >
                        {isSending ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Transmitiendo...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Despegar Ahora
                            </>
                        )}
                        {/* Shimmer Effect */}
                        {!isSending && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:animate-[shimmer_2s_infinite] transition-transform duration-1000" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const EvidencePanel: React.FC<EvidencePanelProps> = ({ evidence, assistantText, isIdle }) => {
    if (isIdle) {
        return (
            <div className="flex-1 flex items-center justify-center glass-card border-dashed border-white/5 animate-in fade-in duration-1000">
                <div className="text-center p-8 max-w-sm">
                    <div className="w-20 h-20 bg-white/5 rounded-[28px] border border-white/10 flex items-center justify-center mx-auto mb-8 shadow-2xl relative overflow-hidden group hover:scale-105 transition-transform duration-500">
                        <div className="absolute inset-0 bg-accent-blue/5 animate-pulse" />
                        <Layers size={32} className="text-accent-blue relative z-10" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 tracking-tight">Área de Inteligencia</h3>
                    <p className="text-white/70 leading-relaxed text-[11px]">Inicia una sesión con Amalia para visualizar las evidencias operativas y flujos de datos en tiempo real.</p>
                </div>
            </div>
        );
    }

    if (evidence.length === 0) {
        return (
            <div className="flex-1 flex flex-col glass-card animate-in slide-in-from-right-8 duration-700">
                <div className="p-8 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-accent-blue/20 rounded-xl text-accent-blue shadow-[0_0_20px_rgba(0,210,255,0.3)]">
                            <Cpu size={20} className="animate-pulse" />
                        </div>
                        <h2 className="text-sm font-light tracking-[0.05em] text-white/90">Amalia intelligence</h2>
                    </div>
                    <p className="text-white/80 leading-relaxed text-[13px] font-medium border-l-2 border-accent-blue pl-4 py-1 italic">
                        {assistantText}
                    </p>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 opacity-40">
                        <Terminal size={24} className="text-white" />
                    </div>
                    <p className="text-white/30 text-[10px] font-light tracking-wider">Awaiting operation telemetry...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col glass-card animate-in slide-in-from-right-8 duration-700">
            <div className="p-8 border-b border-white/10 bg-white/[0.02] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/5 blur-[100px] -mr-32 -mt-32 transition-all duration-1000 group-hover:bg-accent-blue/10" />
                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="p-2.5 bg-accent-blue/20 rounded-xl text-accent-blue shadow-[0_0_20px_rgba(0,210,255,0.2)]">
                        <Cpu size={20} />
                    </div>
                    <h2 className="text-sm font-light tracking-[0.05em] text-white/90">Telemetry analysis</h2>
                </div>
                <p className="text-white/90 leading-relaxed text-[13px] font-medium border-l-2 border-accent-blue pl-4 py-1 relative z-10 italic">
                    {assistantText}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12">
                {evidence.map((item, idx) => (
                    <div key={idx} className="animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${idx * 150}ms` }}>
                        <div className="flex items-center gap-2 mb-6 group">
                            <div className="w-1 h-4 bg-accent-blue rounded-full transition-all duration-300 group-hover:h-6" />
                            <h3 className="text-[11px] font-light tracking-[0.05em] text-white/40 group-hover:text-white/60 transition-colors">
                                {item.title}
                            </h3>
                        </div>

                        <div className="space-y-8">
                            {/* Charts */}
                            {item.chartData && (
                                <div className="h-[300px] w-full bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:bg-white/[0.04] transition-colors duration-500 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-blue/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={item.chartData.labels.map((label, i) => ({
                                            name: label,
                                            value1: item.chartData?.datasets[0]?.data[i],
                                            value2: item.chartData?.datasets[1]?.data[i],
                                            meta1: item.chartData?.datasets[0]?.meta?.[i],
                                            meta2: item.chartData?.datasets[1]?.meta?.[i]
                                        }))}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700 }}
                                                interval={0}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700 }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'rgba(5, 8, 14, 0.95)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '16px',
                                                    fontSize: '11px',
                                                    backdropFilter: 'blur(10px)',
                                                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                                                }}
                                                itemStyle={{ color: '#fff', padding: '4px 0' }}
                                            />
                                            <Legend
                                                wrapperStyle={{ paddingTop: '20px', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                            />
                                            {item.chartData.datasets.map((ds, dsIdx) => (
                                                <Bar
                                                    key={dsIdx}
                                                    dataKey={`value${dsIdx + 1}`}
                                                    name={ds.label}
                                                    radius={[6, 6, 0, 0]}
                                                    barSize={24}
                                                >
                                                    {item.chartData?.labels.map((_, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={dsIdx === 0
                                                                ? (item.chartData?.datasets[0]?.meta?.[index]?.color || '#00d2ff')
                                                                : '#f472b6'
                                                            }
                                                            fillOpacity={0.8}
                                                        />
                                                    ))}
                                                </Bar>
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Tree Visualization */}
                            {item.treeData && (
                                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-6 right-8 flex items-center gap-2 z-20">
                                        <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                                        <span className="text-[8px] font-light text-white/30 tracking-[0.05em]">Dependency graph live</span>
                                    </div>
                                    <TreeVisualizer node={item.treeData} />
                                </div>
                            )}

                            {/* Email Draft Visualization */}
                            {item.emailDraft && (
                                <EmailDraftVisualizer draft={item.emailDraft} />
                            )}

                            {/* SQL Preview */}
                            {item.sql && (
                                <div className="bg-[#05080e]/90 rounded-xl p-4 font-mono text-[10px] text-accent-blue/60 overflow-x-auto border border-white/5 shadow-xl relative">
                                    <div className="absolute top-3 right-4 opacity-50"><Terminal size={12} /></div>
                                    <code className="block pr-8">{item.sql}</code>
                                </div>
                            )}

                            {/* Data Table */}
                            {item.rowsPreview && item.rowsPreview.length > 0 && (
                                <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/10">
                                                    {Object.keys(item.rowsPreview[0]).map(key => (
                                                        <th key={key} className="px-5 py-4 text-[9px] font-light text-white/40 tracking-wider">
                                                            {key.toLowerCase()}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/[0.05]">
                                                {item.rowsPreview.map((row, rIdx) => (
                                                    <tr key={rIdx} className="hover:bg-white/[0.03] transition-colors duration-200">
                                                        {Object.values(row).map((val: any, vIdx) => (
                                                            <td key={vIdx} className={`px-5 py-4 text-[11px] ${val === 'PENDING' || val === 'PENDING_APPROVAL' ? 'text-accent-amber font-bold' :
                                                                val === 'APPROVED' || val === 'MATCHED' ? 'text-accent-emerald font-bold' :
                                                                    val === 'EXCEPTION' ? 'text-accent-rose font-bold' : 'text-white/70'
                                                                }`}>
                                                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Notes/Citations */}
                            {item.notes && (
                                <div className="flex items-start gap-3 bg-accent-blue/5 border border-accent-blue/10 rounded-2xl p-5 group hover:bg-accent-blue/10 transition-colors duration-300">
                                    <div className="p-2 bg-accent-blue/20 rounded-lg text-accent-blue group-hover:scale-110 transition-transform duration-300">
                                        <Info size={14} />
                                    </div>
                                    <p className="text-[11px] text-white/50 leading-relaxed font-medium">
                                        {item.notes}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
