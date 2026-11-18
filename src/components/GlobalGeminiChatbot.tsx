import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bot,
  Database,
  ExternalLink,
  Globe,
  History,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useBetaAuth } from '../beta/AuthContext';
import {
  appendChatMessage,
  createUserChat,
  deleteUserChat,
  subscribeChatMessages,
  subscribeUserChats,
  type ChatToolUsed,
  type FirestoreChatMessage,
  type FirestoreChatSession,
  type GroundingLinkItem,
} from '../lib/firestoreStore';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUsed?: ChatToolUsed;
  groundingLinks?: GroundingLinkItem[];
  sourcesUsed?: string[];
}

function resolveScreenLabel(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Página Inicial';
  if (pathname.startsWith('/painel') || pathname.startsWith('/demo')) {
    return `Demonstração Atlântica Moda (${pathname})`;
  }
  if (pathname.startsWith('/beta/login')) return 'Login Beta';
  if (pathname.startsWith('/beta/cadastro')) return 'Cadastro Beta';
  if (pathname.startsWith('/beta/recuperar-senha')) return 'Recuperação de Senha Beta';
  if (pathname.startsWith('/beta/onboarding')) return 'Cadastro da Empresa (Onboarding)';
  if (pathname.startsWith('/beta/app')) {
    const seg = pathname.replace(/^\/beta\/app\/?/, '') || 'painel';
    return `Painel Beta · ${seg}`;
  }
  return pathname;
}

const TOOL_BADGE: Record<ChatToolUsed, { label: string; icon: React.FC<{ className?: string }> }> = {
  cloudsql: { label: 'Cloud SQL', icon: Database },
  maps: { label: 'Google Maps', icon: MapPin },
  search: { label: 'Busca Google', icon: Globe },
  general: { label: 'Gemini IA', icon: Sparkles },
};

export const GlobalGeminiChatbot: React.FC = () => {
  const location = useLocation();
  const { firebaseUser, companies, activeCompanyId, apiFetch, signInWithGoogle } = useBetaAuth();

  const [open, setOpen] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [friendlyError, setFriendlyError] = useState('');

  // Firestore state for signed-in user
  const [chats, setChats] = useState<FirestoreChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [firestoreMessages, setFirestoreMessages] = useState<FirestoreChatMessage[]>([]);

  // In-memory state when signed-out (public/demo/auth screens)
  const [publicMessages, setPublicMessages] = useState<LocalMessage[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) || companies[0] || null,
    [companies, activeCompanyId]
  );

  const screenContext = useMemo(() => resolveScreenLabel(location.pathname), [location.pathname]);

  // Listen to global open triggers (e.g. from BetaWorkspace header button)
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('gemeo-open-assistant', handleOpen);
    return () => window.removeEventListener('gemeo-open-assistant', handleOpen);
  }, []);

  // Subscribe to user's Firestore chat sessions when authenticated
  useEffect(() => {
    if (!firebaseUser) {
      setChats([]);
      setActiveChatId(null);
      setFirestoreMessages([]);
      return;
    }

    const unsub = subscribeUserChats(firebaseUser.uid, (nextChats) => {
      setChats(nextChats);
      setActiveChatId((prev) => {
        if (prev && nextChats.some((c) => c.id === prev)) return prev;
        return nextChats.length > 0 ? nextChats[0].id : null;
      });
    });

    return () => unsub();
  }, [firebaseUser]);

  // Subscribe to active chat messages in Firestore
  useEffect(() => {
    if (!firebaseUser || !activeChatId) {
      setFirestoreMessages([]);
      return;
    }
    const unsub = subscribeChatMessages(firebaseUser.uid, activeChatId, (msgs) => {
      setFirestoreMessages(msgs);
    });
    return () => unsub();
  }, [firebaseUser, activeChatId]);

  const displayedMessages: LocalMessage[] = useMemo(() => {
    if (firebaseUser) {
      return firestoreMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolUsed: m.toolUsed,
        groundingLinks: m.groundingLinks,
        sourcesUsed: m.sourcesUsed,
      }));
    }
    return publicMessages;
  }, [firebaseUser, firestoreMessages, publicMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedMessages.length, loading, open]);

  const handleNewChat = async () => {
    setFriendlyError('');
    if (!firebaseUser) {
      setPublicMessages([]);
      setShowHistoryList(false);
      return;
    }
    try {
      const newId = await createUserChat(firebaseUser.uid, {
        title: `Conversa · ${activeCompany?.name || 'Gêmeo Digital'}`,
        companyId: activeCompany?.id || 0,
        companyName: activeCompany?.name || '',
      });
      setActiveChatId(newId);
      setShowHistoryList(false);
    } catch {
      setFriendlyError('Não foi possível iniciar uma nova conversa agora. Tente novamente.');
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!firebaseUser) return;
    try {
      await deleteUserChat(firebaseUser.uid, chatId);
      if (activeChatId === chatId) {
        const remaining = chats.filter((c) => c.id !== chatId);
        setActiveChatId(remaining[0]?.id || null);
      }
    } catch {
      setFriendlyError('Não foi possível excluir esta conversa no momento.');
    }
  };

  const handleSend = async (e?: React.FormEvent, overrideQuestion?: string) => {
    e?.preventDefault();
    const q = (overrideQuestion ?? input).trim();
    if (!q || loading) return;

    setFriendlyError('');
    if (!overrideQuestion) setInput('');
    setLoading(true);

    // Build FULL conversation history so Gemini remembers the entire conversation
    const fullHistory = displayedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      if (firebaseUser) {
        let chatId = activeChatId;
        let currentCount = chats.find((c) => c.id === chatId)?.messageCount || firestoreMessages.length;

        if (!chatId) {
          chatId = await createUserChat(firebaseUser.uid, {
            title: q.slice(0, 80),
            companyId: activeCompany?.id || 0,
            companyName: activeCompany?.name || '',
          });
          setActiveChatId(chatId);
          currentCount = 0;
        }

        // Persist user message to Firestore
        await appendChatMessage(firebaseUser.uid, chatId, {
          role: 'user',
          content: q,
          toolUsed: 'general',
          screenContext,
          currentMessageCount: currentCount,
          titleIfEmpty: currentCount === 0 ? q.slice(0, 80) : undefined,
          companyId: activeCompany?.id || 0,
          companyName: activeCompany?.name || '',
        });

        const res = await apiFetch<{
          answer: string;
          toolUsed?: ChatToolUsed;
          groundingLinks?: GroundingLinkItem[];
          sourcesUsed?: string[];
        }>('/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            question: q,
            screenContext,
            companyId: activeCompany?.id || null,
            history: [...fullHistory, { role: 'user', content: q }],
          }),
        });

        // Persist assistant response to Firestore
        await appendChatMessage(firebaseUser.uid, chatId, {
          role: 'assistant',
          content: res.answer,
          toolUsed: res.toolUsed || 'cloudsql',
          screenContext,
          groundingLinks: res.groundingLinks || [],
          sourcesUsed: res.sourcesUsed || [],
          currentMessageCount: currentCount + 1,
          companyId: activeCompany?.id || 0,
          companyName: activeCompany?.name || '',
        });
      } else {
        const nextHistory: LocalMessage[] = [
          ...publicMessages,
          { id: `u_${Date.now()}`, role: 'user', content: q },
        ];
        setPublicMessages(nextHistory);

        const resp = await fetch('/api/public/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q,
            screenContext,
            history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          answer?: string;
          toolUsed?: ChatToolUsed;
          groundingLinks?: GroundingLinkItem[];
          sourcesUsed?: string[];
          error?: string;
        };
        if (!resp.ok) {
          throw new Error(data.error || 'Erro na resposta da inteligência.');
        }

        setPublicMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            content: data.answer || 'Não encontrei essa informação.',
            toolUsed: data.toolUsed || 'general',
            groundingLinks: data.groundingLinks || [],
            sourcesUsed: data.sourcesUsed || [],
          },
        ]);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const isRawJsonOrLimit =
        !raw ||
        raw.trim().startsWith('{') ||
        raw.includes('RESOURCE_EXHAUSTED') ||
        raw.includes('quota');
      setFriendlyError(
        isRawJsonOrLimit
          ? 'O assistente está temporariamente ocupado ou atingiu o limite de consultas. Aguarde alguns instantes e tente novamente.'
          : raw
      );
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = firebaseUser
    ? [
        'Quais empresas minhas estão no Cloud SQL e a distância entre elas?',
        'Quais concorrentes ou lugares existem perto da minha empresa no Google Maps?',
        'Como está a taxa Selic / inflação hoje no Brasil?',
      ]
    : [
        'Como funciona o Gêmeo Digital?',
        'Busque rotas ou locais comerciais no centro de São Paulo no Maps',
        'Qual a taxa Selic atual hoje no Brasil?',
      ];

  return (
    <div className="fixed bottom-16 lg:bottom-5 right-5 z-50 no-print">
      {open ? (
        <div className="w-[92vw] sm:w-[410px] rounded-2xl border border-[#20C5D5]/35 bg-[var(--bg-card)] shadow-2xl overflow-hidden flex flex-col max-h-[78vh]">
          {/* Header */}
          <div className="bg-[var(--bg-sidebar)] border-b border-[var(--border-subtle)] text-white px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Bot className="h-4 w-4 text-[#20C5D5] shrink-0" />
                <span className="truncate">
                  {activeCompany ? `Gemini IA · ${activeCompany.name}` : 'Chatbot Gêmeo Digital'}
                </span>
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">
                {screenContext}
                {firebaseUser ? ' · Histórico salvo no Firestore' : ' · Modo público'}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {firebaseUser && (
                <button
                  type="button"
                  onClick={() => setShowHistoryList((v) => !v)}
                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#20C5D5] hover:bg-[#102B50] cursor-pointer"
                  title="Histórico de conversas (Firestore)"
                  aria-label="Histórico de conversas"
                >
                  <History className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleNewChat()}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#20C5D5] hover:bg-[#102B50] cursor-pointer"
                title="Nova conversa"
                aria-label="Nova conversa"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[#102B50] cursor-pointer"
                aria-label="Fechar chatbot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Firestore Thread Switcher */}
          {firebaseUser && showHistoryList && (
            <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/90 p-2.5 max-h-44 overflow-y-auto space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-1">
                <span>Suas conversas ({chats.length})</span>
                <button
                  type="button"
                  onClick={() => void handleNewChat()}
                  className="text-[#20C5D5] hover:underline cursor-pointer"
                >
                  + Nova
                </button>
              </div>
              {chats.length === 0 ? (
                <div className="text-[11px] text-[var(--text-secondary)] px-1 py-2">
                  Nenhuma conversa salva ainda. Envie uma mensagem abaixo.
                </div>
              ) : (
                chats.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors ${
                      c.id === activeChatId
                        ? 'bg-[#15365F] border border-[#20C5D5]/40 text-white'
                        : 'hover:bg-[#102B50] text-[var(--text-secondary)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChatId(c.id);
                        setShowHistoryList(false);
                      }}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className="font-medium truncate text-[11px] text-white">{c.title}</div>
                      <div className="text-[10px] truncate opacity-75">
                        {c.messageCount} msg · {c.lastMessagePreview || 'Sem mensagens'}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteChat(c.id)}
                      className="p-1 text-[var(--text-secondary)] hover:text-[#EF6464] cursor-pointer shrink-0"
                      aria-label="Excluir conversa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Optional Quick Google Sign-In bar when logged out */}
          {!firebaseUser && (
            <div className="bg-[#102B50] border-b border-[var(--border-subtle)] px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-[var(--text-secondary)]">
                Entre para consultar suas empresas (Cloud SQL) e salvar o chat.
              </span>
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="rounded-md bg-[#20C5D5] px-2.5 py-1 font-semibold text-[#06132D] hover:bg-[#38d3e2] cursor-pointer shrink-0"
              >
                Entrar Google
              </button>
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs bg-[var(--bg-main)]/40 min-h-[240px]"
          >
            {displayedMessages.length === 0 ? (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-[var(--text-primary)] leading-relaxed">
                  Olá{firebaseUser?.displayName ? `, ${firebaseUser.displayName}` : ''}! Sou o Chatbot Gemini do Gêmeo Digital.
                  {firebaseUser
                    ? ' Consulto suas empresas e distâncias no Cloud SQL, rotas reais no Google Maps e informações atuais na Busca do Google — lembrando toda a conversa.'
                    : ' Posso responder sobre a plataforma, consultar locais/rotas no Google Maps ou buscar informações atuais na web.'}
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] px-1">
                    Sugestões rápidas
                  </div>
                  {quickPrompts.map((qp) => (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => void handleSend(undefined, qp)}
                      className="w-full text-left rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 px-2.5 py-1.5 text-[11px] text-[#20C5D5] hover:border-[#20C5D5] cursor-pointer transition-colors"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              displayedMessages.map((m) => {
                const badge = m.toolUsed ? TOOL_BADGE[m.toolUsed] : null;
                const BadgeIcon = badge?.icon;
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl p-2.5 whitespace-pre-wrap leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-[#15365F] border border-[#20C5D5]/30 text-white ml-7'
                        : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] mr-3'
                    }`}
                  >
                    {m.role === 'assistant' && badge && BadgeIcon && (
                      <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#20C5D5] mb-1">
                        <BadgeIcon className="h-3 w-3" />
                        <span>{badge.label}</span>
                      </div>
                    )}
                    <div>{m.content}</div>

                    {m.groundingLinks && m.groundingLinks.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-[var(--border-subtle)] space-y-1">
                        <div className="text-[10px] font-semibold text-[var(--text-secondary)]">
                          Fontes verificadas:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.groundingLinks.slice(0, 5).map((link, idx) => (
                            <a
                              key={`${link.uri}-${idx}`}
                              href={link.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-[#20C5D5] hover:border-[#20C5D5]"
                            >
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate max-w-[160px]">{link.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {m.sourcesUsed && m.sourcesUsed.length > 0 && (
                      <div className="mt-1.5 text-[10px] text-[var(--text-secondary)]">
                        Base: {m.sourcesUsed.slice(0, 3).join(' · ')}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {loading && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[#20C5D5] mr-12">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span className="font-medium">digitando...</span>
              </div>
            )}

            {friendlyError && (
              <div className="rounded-lg border border-[#EF6464]/40 bg-[#EF6464]/10 px-3 py-2 text-[11px] text-[#EF6464] flex items-start justify-between gap-2">
                <span>{friendlyError}</span>
                <button
                  type="button"
                  onClick={() => setFriendlyError('')}
                  className="hover:text-white cursor-pointer shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="px-3 py-1 bg-[var(--bg-sidebar)] border-t border-[var(--border-subtle)] text-[10px] text-[#F2B84B]">
            Respostas baseadas apenas em dados reais consultados (Cloud SQL / Maps / Busca).
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => void handleSend(e)}
            className="p-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre empresas, rotas km, mercado..."
              disabled={loading}
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-[#20C5D5] px-3 py-2 text-[#06132D] font-semibold hover:bg-[#38d3e2] cursor-pointer disabled:opacity-50"
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
          className="inline-flex items-center gap-2 rounded-full border border-[#20C5D5]/50 bg-[#102B50] px-4 py-2.5 text-xs font-bold text-[#F4F8FF] shadow-xl hover:border-[#20C5D5] hover:bg-[#15365F] transition-all cursor-pointer"
          aria-label="Abrir Chatbot Gemini"
        >
          <Bot className="h-4 w-4 text-[#20C5D5]" />
          <span>Chatbot IA</span>
        </button>
      )}
    </div>
  );
};
