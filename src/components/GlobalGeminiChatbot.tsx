import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe,
  History,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Paperclip,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useBetaAuth } from '../beta/AuthContext';
import {
  appendChatMessage,
  createUserChat,
  deleteUserChat,
  filterChatsByCompany,
  subscribeChatMessages,
  subscribeUserChats,
  type ChatToolUsed,
  type FirestoreChatMessage,
  type FirestoreChatSession,
  type GroundingLinkItem,
} from '../lib/firestoreStore';
import { safeExternalHref } from '../lib/safeUrl';

interface PendingProposalItem {
  proposalToken: string;
  functionName: string;
  title: string;
  summary: string;
  args: Record<string, unknown>;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface AttachmentDraft {
  fileName: string;
  mimeType: string;
  base64Data: string;
  sizeBytes: number;
}

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUsed?: ChatToolUsed;
  groundingLinks?: GroundingLinkItem[];
  sourcesUsed?: string[];
  toolsInvoked?: string[];
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
  const [filterByActiveCompany, setFilterByActiveCompany] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [firestoreMessages, setFirestoreMessages] = useState<FirestoreChatMessage[]>([]);

  // Multimodal attachment & authorized actions state
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [pendingProposals, setPendingProposals] = useState<PendingProposalItem[]>([]);
  const [resolvingToken, setResolvingToken] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // In-memory state when signed-out (public/demo/auth screens)
  const [publicMessages, setPublicMessages] = useState<LocalMessage[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) || companies[0] || null,
    [companies, activeCompanyId]
  );

  const visibleChats = useMemo(() => {
    if (!filterByActiveCompany || !activeCompany) return chats;
    return filterChatsByCompany(chats, activeCompany.id);
  }, [chats, filterByActiveCompany, activeCompany]);

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
      setPendingProposals([]);
      setAttachment(null);
      return;
    }

    const unsub = subscribeUserChats(firebaseUser.uid, (nextChats) => {
      setChats(nextChats);
    });

    return () => unsub();
  }, [firebaseUser]);

  // Keep activeChatId aligned with active company chats when switching companies
  useEffect(() => {
    if (!firebaseUser) return;
    setActiveChatId((prev) => {
      if (prev && visibleChats.some((c) => c.id === prev)) return prev;
      return visibleChats.length > 0 ? visibleChats[0].id : null;
    });
  }, [firebaseUser, visibleChats, activeCompany?.id]);

  // Load pending proposals for active company when drawer opens
  useEffect(() => {
    if (!open || !firebaseUser || !activeCompany?.id) return;
    let cancelled = false;
    apiFetch<{ pendingProposals?: PendingProposalItem[] }>(
      `/api/beta/companies/${activeCompany.id}/ai/status`
    )
      .then((res) => {
        if (!cancelled && Array.isArray(res.pendingProposals)) {
          setPendingProposals(res.pendingProposals);
        }
      })
      .catch(() => {
        // non-blocking
      });
    return () => {
      cancelled = true;
    };
  }, [open, firebaseUser, activeCompany?.id, apiFetch]);

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

  const handlePickAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setFriendlyError('O arquivo anexo excede o limite de 6 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setAttachment({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Data: base64,
        sizeBytes: file.size,
      });
      setFriendlyError('');
    };
    reader.onerror = () => {
      setFriendlyError('Não foi possível ler o arquivo selecionado.');
    };
    reader.readAsDataURL(file);
  };

  const handleResolveProposal = async (token: string, action: 'approve' | 'reject') => {
    if (!activeCompany?.id || resolvingToken) return;
    setResolvingToken(token);
    setFriendlyError('');
    setActionFeedback('');
    try {
      const res = await apiFetch<{ ok?: boolean; message?: string }>(
        `/api/beta/companies/${activeCompany.id}/ai/actions/${encodeURIComponent(token)}/${action}`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      setPendingProposals((prev) => prev.filter((p) => p.proposalToken !== token));
      setActionFeedback(res.message || (action === 'approve' ? 'Ação autorizada e executada.' : 'Proposta cancelada.'));
      if (action === 'approve') {
        window.dispatchEvent(new CustomEvent('gemeo-workspace-updated'));
      }
    } catch (err) {
      setFriendlyError(err instanceof Error ? err.message : 'Não foi possível processar a autorização.');
    } finally {
      setResolvingToken(null);
    }
  };

  const handleSend = async (e?: React.FormEvent, overrideQuestion?: string) => {
    e?.preventDefault();
    const q = (overrideQuestion ?? input).trim();
    const currentAttachment = firebaseUser && activeCompany ? attachment : null;
    if ((!q && !currentAttachment) || loading) return;

    const effectiveQuestion = q || `Analise o arquivo anexo (${currentAttachment?.fileName || 'documento'}).`;

    setFriendlyError('');
    setActionFeedback('');
    if (!overrideQuestion) setInput('');
    setAttachment(null);
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
            title: effectiveQuestion.slice(0, 80),
            companyId: activeCompany?.id || 0,
            companyName: activeCompany?.name || '',
          });
          setActiveChatId(chatId);
          currentCount = 0;
        }

        const userDisplayMsg = currentAttachment
          ? `${effectiveQuestion}\n[Anexo: ${currentAttachment.fileName}]`
          : effectiveQuestion;

        // Persist user message to Firestore
        await appendChatMessage(firebaseUser.uid, chatId, {
          role: 'user',
          content: userDisplayMsg,
          toolUsed: 'general',
          screenContext,
          currentMessageCount: currentCount,
          titleIfEmpty: currentCount === 0 ? effectiveQuestion.slice(0, 80) : undefined,
          companyId: activeCompany?.id || 0,
          companyName: activeCompany?.name || '',
        });

        const res = await apiFetch<{
          answer: string;
          toolUsed?: ChatToolUsed;
          groundingLinks?: GroundingLinkItem[];
          sourcesUsed?: string[];
          toolsInvoked?: string[];
          pendingProposals?: PendingProposalItem[];
        }>('/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            question: effectiveQuestion,
            screenContext,
            companyId: activeCompany?.id || null,
            history: [...fullHistory, { role: 'user', content: userDisplayMsg }],
            attachment: currentAttachment
              ? {
                  fileName: currentAttachment.fileName,
                  mimeType: currentAttachment.mimeType,
                  base64Data: currentAttachment.base64Data,
                }
              : null,
          }),
        });

        if (Array.isArray(res.pendingProposals) && res.pendingProposals.length > 0) {
          setPendingProposals((prev) => {
            const map = new Map(prev.map((p) => [p.proposalToken, p]));
            res.pendingProposals!.forEach((p) => map.set(p.proposalToken, p));
            return Array.from(map.values());
          });
        }

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
          { id: `u_${Date.now()}`, role: 'user', content: effectiveQuestion },
        ];
        setPublicMessages(nextHistory);

        const resp = await fetch('/api/public/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: effectiveQuestion,
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

          {/* Firestore Thread Switcher (per-company isolation + all toggle) */}
          {firebaseUser && showHistoryList && (
            <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/90 p-2.5 max-h-48 overflow-y-auto space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-1">
                <span>
                  {filterByActiveCompany && activeCompany
                    ? `Empresa: ${activeCompany.name} (${visibleChats.length})`
                    : `Todas as conversas (${visibleChats.length})`}
                </span>
                <div className="flex items-center gap-2">
                  {activeCompany && (
                    <button
                      type="button"
                      onClick={() => setFilterByActiveCompany((v) => !v)}
                      className="text-[10px] text-[var(--text-secondary)] hover:text-[#20C5D5] cursor-pointer"
                    >
                      {filterByActiveCompany ? 'Ver todas' : 'Só empresa ativa'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleNewChat()}
                    className="text-[#20C5D5] hover:underline cursor-pointer"
                  >
                    + Nova
                  </button>
                </div>
              </div>
              {visibleChats.length === 0 ? (
                <div className="text-[11px] text-[var(--text-secondary)] px-1 py-2">
                  Nenhuma conversa salva para esta seleção. Envie uma mensagem abaixo.
                </div>
              ) : (
                visibleChats.map((c) => (
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
                        {c.companyName ? `${c.companyName} · ` : ''}
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
                          {m.groundingLinks.slice(0, 5).map((link, idx) => {
                            const safeHref = safeExternalHref(link.uri);
                            if (!safeHref) return null;
                            return (
                              <a
                                key={`${safeHref}-${idx}`}
                                href={safeHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded bg-[var(--bg-sidebar)] border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-[#20C5D5] hover:border-[#20C5D5]"
                              >
                                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate max-w-[160px]">{link.title}</span>
                              </a>
                            );
                          })}
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

            {pendingProposals.length > 0 && activeCompany && (
              <div className="space-y-2 pt-1">
                {pendingProposals.map((prop) => (
                  <div
                    key={prop.proposalToken}
                    className="rounded-xl border border-[#F2B84B]/50 bg-[#F2B84B]/10 p-2.5 space-y-2 text-[11px]"
                  >
                    <div className="flex items-start gap-1.5 text-[#F2B84B] font-semibold">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Autorização necessária: {prop.title}</span>
                    </div>
                    <p className="text-[var(--text-primary)] leading-snug">{prop.summary}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        disabled={resolvingToken === prop.proposalToken}
                        onClick={() => void handleResolveProposal(prop.proposalToken, 'approve')}
                        className="inline-flex items-center gap-1 rounded-md bg-[#20B981] px-2.5 py-1 text-[10px] font-bold text-[#06132D] hover:opacity-90 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{resolvingToken === prop.proposalToken ? 'Executando...' : 'Autorizar e Executar'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={resolvingToken === prop.proposalToken}
                        onClick={() => void handleResolveProposal(prop.proposalToken, 'reject')}
                        className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:text-white cursor-pointer disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {actionFeedback && (
              <div className="rounded-lg border border-[#20B981]/40 bg-[#20B981]/10 px-3 py-2 text-[11px] text-[#20B981] flex items-center justify-between gap-2">
                <span>{actionFeedback}</span>
                <button
                  type="button"
                  onClick={() => setActionFeedback('')}
                  className="hover:text-white cursor-pointer shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
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
            Respostas baseadas em dados reais (Cloud SQL / Maps / Busca) e ações só executam com sua aprovação.
          </div>

          {attachment && (
            <div className="px-3 py-1.5 bg-[#102B50] border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-[11px] text-[#20C5D5]">
              <span className="truncate">
                Anexo: {attachment.fileName} ({Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB)
              </span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="text-[var(--text-secondary)] hover:text-white cursor-pointer"
                aria-label="Remover anexo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => void handleSend(e)}
            className="p-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] flex gap-1.5 items-center"
          >
            {firebaseUser && activeCompany && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={handlePickAttachment}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  title="Anexar PDF, Excel, CSV ou imagem (máx. 6 MB)"
                  aria-label="Anexar documento ou planilha"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] p-2 text-[var(--text-secondary)] hover:text-[#20C5D5] hover:border-[#20C5D5] cursor-pointer disabled:opacity-50"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                attachment
                  ? 'O que deseja analisar neste arquivo?'
                  : 'Pergunte sobre empresas, rotas km, mercado...'
              }
              disabled={loading}
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#20C5D5]"
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && !attachment)}
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
