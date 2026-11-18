import React, { useState } from 'react';
import { Bot, Loader2, Send, X } from 'lucide-react';
import { useBetaAuth } from './AuthContext';

interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

export const BetaAssistantWidget: React.FC<{
  companyId: number;
  companyName: string;
  screenContext: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}> = ({ companyId, companyName, screenContext, externalOpen, onExternalOpenChange }) => {
  const { apiFetch } = useBetaAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onExternalOpenChange?.(v);
  };

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: 'assistant',
      content: `Olá! Sou o Assistente de Inteligência da ${companyName}. Posso interpretar indicadores, PESTEL, Porter, SWOT/TOWS, concorrentes, margens e prioridades usando exclusivamente os dados da sua empresa e fontes públicas conectadas.`,
    },
  ]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    const nextHistory = [...messages, { role: 'user' as const, content: q }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await apiFetch<{ answer: string; sourcesUsed?: string[] }>(
        `/api/beta/companies/${companyId}/assistant`,
        {
          method: 'POST',
          body: JSON.stringify({
            question: q,
            screenContext,
            history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          }),
        }
      );
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          sources: res.sourcesUsed,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            err instanceof Error
              ? `Erro ao consultar assistente: ${err.message}`
              : 'Erro ao consultar assistente.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-16 lg:bottom-5 right-5 z-40 no-print">
      {open ? (
        <div className="w-80 sm:w-96 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
          <div className="bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)] text-white px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Bot className="h-4 w-4 text-[#20C5D5] shrink-0" />
                <span className="truncate">Assistente IA · {companyName}</span>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] truncate">
                Contexto: {screenContext}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[var(--text-secondary)] hover:text-white cursor-pointer"
              aria-label="Fechar assistente"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs bg-[var(--bg-main)]/40">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-2.5 whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#15365F] border border-[#20C5D5]/30 text-white ml-6'
                    : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] mr-3'
                }`}
              >
                {m.content}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)]">
                    Fontes consultadas: {m.sources.slice(0, 4).join(' · ')}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] p-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#20C5D5]" />
                <span>Analisando dados internos e fontes oficiais...</span>
              </div>
            )}
          </div>

          <div className="px-3 py-1.5 bg-[var(--bg-sidebar)] border-t border-[var(--border-subtle)] text-[10px] text-[#F2B84B]">
            Não substitui aconselhamento jurídico, contábil ou tributário.
          </div>

          <form
            onSubmit={handleSend}
            className="p-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre margem, SWOT, riscos..."
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#20C5D5] px-3 py-1.5 text-[#06132D] font-semibold hover:bg-[#38d3e2] cursor-pointer disabled:opacity-50"
              aria-label="Enviar mensagem"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[#20C5D5]/40 bg-[#102B50] px-4 py-2.5 text-xs font-semibold text-[#F4F8FF] shadow-lg hover:border-[#20C5D5] transition-colors cursor-pointer"
        >
          <Bot className="h-4 w-4 text-[#20C5D5]" />
          <span>Assistente IA</span>
        </button>
      )}
    </div>
  );
};
