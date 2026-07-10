import { MessageCircle, Send, X, Minimize2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { sendChatMessage, fetchConversationMessages, subscribeToChatMessages, type DbChatMessage } from '../lib/db';
import { readSiteSettings } from '../lib/siteSettings';
import { botReply, createBotState, type BotState } from '../lib/bot';

const CHAT_ID_KEY = 'tof-chat-id-v2';
const CHAT_NAME_KEY = 'tof-chat-name';
const CHAT_OPEN_KEY = 'tof-chat-open';
const CHAT_WELCOMED_KEY = 'tof-chat-welcomed-v2';

/** Délai d'inactivité avant que le bot réponde à une rafale de messages. */
const BOT_IDLE_DELAY = 1400;
/** Délai mini avant la première réponse du bot (effet "en train d'écrire"). */
const BOT_TYPING_MIN = 600;
const BOT_TYPING_MAX = 1100;

const quickButtons = [
  { label: '🛒 Commander', text: 'Je veux commander' },
  { label: '📦 Livraison', text: 'Quels sont les délais de livraison ?' },
  { label: '💳 Paiement', text: 'Comment payer ?' },
  { label: '📐 Tailles', text: 'Comment taillent les pièces ?' },
  { label: '🏷️ Marques', text: 'Quelles marques vous avez ?' },
  { label: '💬 WhatsApp', text: 'Contacter WhatsApp' },
];

function getConversationId(): string {
  let id: string | null = null;
  try { id = localStorage.getItem(CHAT_ID_KEY); } catch { /* ignore */ }
  if (!id) {
    id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try { localStorage.setItem(CHAT_ID_KEY, id); } catch { /* ignore */ }
  }
  return id;
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function firstGreeting(userName: string): string {
  const pool = [
    `Salut ${userName} ! 👋 Bienvenue sur tof. Je suis ton assistant. Tu peux me poser une question ou cliquer sur un bouton ci-dessous.`,
    `Hey ${userName} ! 🔥 C'est ton assistant tof. Je peux t'aider à commander, choisir ta taille, ou répondre à tes questions sur la livraison.`,
    `Salut ${userName} ! Content de te voir sur tof. Dis-moi ce que tu cherches, je te guide.`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function returnGreeting(): string {
  const pool = [
    "Hey, content de te revoir ! 👋 Une question sur une pièce, une commande ou une taille ? Je suis là.",
    "Salut ! De retour sur tof ? Dis-moi ce que je peux faire pour toi.",
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function ChatWidget() {
  const [open, setOpen] = useState<boolean>(() => {
    try { return sessionStorage.getItem(CHAT_OPEN_KEY) === '1'; } catch { return false; }
  });
  const [messages, setMessages] = useState<DbChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState<string>(() => { try { return localStorage.getItem(CHAT_NAME_KEY) || ''; } catch { return ''; } });
  const [nameSet, setNameSet] = useState<boolean>(() => { try { return !!localStorage.getItem(CHAT_NAME_KEY); } catch { return false; } });
  const [unread, setUnread] = useState(0);
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showPulse, setShowPulse] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragStart, setDragStart] = useState<{ y: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const conversationId = useMemo(getConversationId, []);
  const settings = useMemo(() => readSiteSettings(), []);
  const botStateRef = useRef<BotState>(createBotState());
  const pendingQueueRef = useRef<string[]>([]);
  const botReplyTimerRef = useRef<number | null>(null);
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, []);

  // Dernière fois qu'un admin a répondu — après ça, le bot se tait.
  const hasAdminReplied = useMemo(
    () => messages.some((m) => m.sender === 'admin'),
    [messages],
  );

  useEffect(() => {
    try { sessionStorage.setItem(CHAT_OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    if (open && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (open) return;
    try { if (sessionStorage.getItem(CHAT_WELCOMED_KEY)) return; } catch { /* ignore */ }
    const t = window.setTimeout(() => setShowPulse(true), 8000);
    return () => window.clearTimeout(t);
  }, [open]);

  const loadMessages = useCallback(async () => {
    try {
      const data = await fetchConversationMessages(conversationId);
      setMessages((prev) => {
        if (!open && data.length > prev.length) {
          const newCount = data.length - prev.length;
          const hasNewFromSupport = data.slice(-newCount).some((m) => m.sender !== 'client');
          if (hasNewFromSupport) setUnread((u) => u + newCount);
        }
        // Rejouer l'état du bot à partir des messages existants pour éviter les répétitions
        const state = botStateRef.current;
        state.covered = new Set();
        state.turn = 0;
        for (const m of data) {
          if (m.sender === 'bot') {
            // Approximation : on ne ré-évalue pas, on incrémente juste turn
            state.turn += 1;
          }
        }
        return data;
      });
      scrollToBottom();
    } catch { /* ignore */ }
  }, [conversationId, open, scrollToBottom]);

  useEffect(() => {
    if (nameSet) void loadMessages();
    const unsub = subscribeToChatMessages(() => { void loadMessages(); });
    return () => unsub();
  }, [nameSet, loadMessages]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      scrollToBottom();
      try { sessionStorage.setItem(CHAT_WELCOMED_KEY, '1'); } catch { /* ignore */ }
      setShowPulse(false);
    }
  }, [open, messages.length, scrollToBottom]);

  // Envoie le message de bienvenue à un nouvel utilisateur
  const sendWelcome = useCallback(async (userName: string, isReturn: boolean) => {
    const text = isReturn ? returnGreeting() : firstGreeting(userName);
    const msg: DbChatMessage = {
      id: `m-${Date.now()}-welcome`,
      conversation_id: conversationId,
      sender: 'bot',
      message: text,
      client_name: userName,
    };
    setMessages([msg]);
    botStateRef.current.userName = userName;
    botStateRef.current.turn = 1;
    await sendChatMessage(msg).catch(() => {});
    setSuggestions(quickButtons.map((b) => b.label));
  }, [conversationId]);

  const submitName = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try { localStorage.setItem(CHAT_NAME_KEY, trimmed); } catch { /* ignore */ }
    setName(trimmed);
    setNameSet(true);
    await sendWelcome(trimmed, false);
  }, [name, sendWelcome]);

  // Si l'utilisateur revient et qu'aucun message n'est en base, envoyer un "re-bienvenue"
  useEffect(() => {
    if (nameSet && messages.length === 0) {
      void sendWelcome(name || 'toi', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameSet, messages.length]);

  const pushBotMessage = useCallback(async (text: string, newSuggestions: string[]) => {
    const botMsg: DbChatMessage = {
      id: `m-${Date.now()}-bot`,
      conversation_id: conversationId,
      sender: 'bot',
      message: text,
      client_name: name,
    };
    setMessages((prev) => [...prev, botMsg]);
    setTyping(false);
    setSuggestions(newSuggestions);
    await sendChatMessage(botMsg).catch(() => {});
    scrollToBottom();
  }, [conversationId, name, scrollToBottom]);

  const flushQueue = useCallback(() => {
    if (botReplyTimerRef.current) {
      window.clearTimeout(botReplyTimerRef.current);
      botReplyTimerRef.current = null;
    }
    const queue = pendingQueueRef.current;
    pendingQueueRef.current = [];
    if (queue.length === 0) return;

    // Si un admin a déjà pris la main, on ne répond plus.
    if (hasAdminReplied) return;

    const decision = botReply(queue, botStateRef.current);

    // Délai "typing" proportionnel à la longueur de la réponse
    const typingDelay = BOT_TYPING_MIN + Math.min(1800, decision.reply.length * 12) + Math.random() * (BOT_TYPING_MAX - BOT_TYPING_MIN);
    setTyping(true);
    window.setTimeout(() => {
      void pushBotMessage(decision.reply, decision.suggestions);
    }, typingDelay);
  }, [hasAdminReplied, pushBotMessage]);

  const queueClientMessage = useCallback(async (text: string) => {
    if (!text.trim() || !nameSet) return;

    const clientMsg: DbChatMessage = {
      id: `m-${Date.now()}`,
      conversation_id: conversationId,
      sender: 'client',
      message: text.trim(),
      client_name: name,
    };
    setMessages((prev) => [...prev, clientMsg]);
    setInput('');
    setSuggestions([]);
    await sendChatMessage(clientMsg).catch(() => {});
    scrollToBottom();

    // Si un admin a déjà répondu, on ne fait plus parler le bot (l'humain a repris)
    if (hasAdminReplied) return;

    // Ajouter dans la file et attendre un peu (rafale)
    pendingQueueRef.current.push(text.trim());
    if (botReplyTimerRef.current) window.clearTimeout(botReplyTimerRef.current);
    botReplyTimerRef.current = window.setTimeout(() => flushQueue(), BOT_IDLE_DELAY);
  }, [conversationId, flushQueue, hasAdminReplied, name, nameSet, scrollToBottom]);

  // Si un admin répond pendant que le bot tape / a une file, annuler le bot
  useEffect(() => {
    if (hasAdminReplied) {
      if (botReplyTimerRef.current) {
        window.clearTimeout(botReplyTimerRef.current);
        botReplyTimerRef.current = null;
      }
      pendingQueueRef.current = [];
      setTyping(false);
      setSuggestions(['💬 Répondre sur WhatsApp']);
    }
  }, [hasAdminReplied]);

  useEffect(() => () => {
    if (botReplyTimerRef.current) window.clearTimeout(botReplyTimerRef.current);
  }, []);

  const onQuick = useCallback((label: string) => {
    if (label.toLowerCase().includes('whatsapp')) {
      window.open(settings.whatsappUrl, '_blank', 'noreferrer');
      return;
    }
    if (label.toLowerCase().includes('snap')) {
      window.open(settings.snapchatUrl, '_blank', 'noreferrer');
      return;
    }
    if (label.toLowerCase().includes('voir le shop') || label.toLowerCase().includes('aller au shop') || label.toLowerCase().includes('shop')) {
      setOpen(false);
      window.location.hash = '#shop';
      return;
    }
    const found = quickButtons.find((b) => b.label === label);
    void queueClientMessage(found ? found.text : label);
  }, [queueClientMessage, settings]);

  // Drag-to-close mobile
  const onTouchStart = (e: React.TouchEvent) => {
    if (!panelRef.current || panelRef.current.scrollTop > 0) { setDragStart(null); return; }
    setDragStart({ y: e.touches[0].clientY });
    setDragY(0);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragStart) return;
    const dy = e.touches[0].clientY - dragStart.y;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 120) setOpen(false);
    setDragY(0);
    setDragStart(null);
  };

  const resetChat = () => {
    if (!confirm('Effacer la conversation sur cet appareil ?')) return;
    try {
      localStorage.removeItem(CHAT_ID_KEY);
      localStorage.removeItem(CHAT_NAME_KEY);
      sessionStorage.removeItem(CHAT_OPEN_KEY);
      sessionStorage.removeItem(CHAT_WELCOMED_KEY);
    } catch { /* ignore */ }
    setName('');
    setNameSet(false);
    setMessages([]);
    setInput('');
    setSuggestions([]);
    botStateRef.current = createBotState();
    pendingQueueRef.current = [];
    if (botReplyTimerRef.current) {
      window.clearTimeout(botReplyTimerRef.current);
      botReplyTimerRef.current = null;
    }
  };

  return (
    <>
      {!open && (
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[70] flex flex-col items-end gap-2">
          {showPulse && !nameSet && (
            <div className="relative mr-1 mb-1 bg-white px-4 py-2.5 rounded-2xl rounded-br-sm shadow-xl text-xs font-semibold text-dark/80 max-w-[220px] anim-fade-up border border-dark/5">
              Besoin d'aide ? On est là 👋
              <button
                onClick={() => { setShowPulse(false); setOpen(true); }}
                className="absolute -bottom-1 right-4 w-3 h-3 bg-white rotate-45 border-r border-b border-dark/5"
                aria-hidden
              />
            </div>
          )}
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le chat"
            className={`relative h-14 w-14 rounded-full bg-accent text-white shadow-2xl shadow-accent/30 flex items-center justify-center hover:bg-accent-light active:scale-95 transition-all ${showPulse ? 'anim-pulse-ring' : ''}`}
          >
            <MessageCircle size={24} strokeWidth={2.5} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-h-5 min-w-5 px-1 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-[80] w-full sm:w-[400px] h-[100dvh] sm:h-[640px] sm:max-h-[calc(100dvh-3rem)] bg-white sm:rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden sm:border border-dark/5 anim-slide-up will-change-transform"
          style={{
            transform: `translateY(${Math.max(0, dragY)}px)`,
            transition: dragStart ? 'none' : 'transform 0.25s ease',
          }}
        >
          {/* Header */}
          <div
            className="bg-[#111111] text-white px-5 py-4 flex items-center justify-between flex-shrink-0 relative overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="sm:hidden flex justify-center w-full absolute top-1.5 left-0">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center gap-3 relative z-10 mt-1 sm:mt-0">
              <div className="relative flex-shrink-0">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-white text-xl font-black shadow-lg shadow-accent/20">
                  t.
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 rounded-full border-[3px] border-[#111111]" />
              </div>
              <div>
                <span className="font-display font-800 text-[17px] leading-tight flex items-center gap-1.5">
                  tof<span className="text-accent">.</span> Support
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-white/50 uppercase tracking-[0.15em] font-bold">
                    {hasAdminReplied ? 'Équipe en ligne' : 'En ligne · réponses instantanées'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 relative z-10">
              <button
                onClick={resetChat}
                aria-label="Recommencer"
                title="Recommencer la conversation"
                className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Réduire"
                className="sm:hidden h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Minimize2 size={18} />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="hidden sm:flex h-10 w-10 rounded-2xl bg-white/5 items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {!nameSet ? (
            <div className="flex-1 flex items-center justify-center p-6 bg-[#FBFBFB]">
              <div className="text-center space-y-6 w-full max-w-[280px]">
                <div className="h-24 w-24 bg-white rounded-[32px] shadow-2xl flex items-center justify-center text-5xl mx-auto anim-float">👋</div>
                <div className="space-y-2">
                  <h3 className="font-display text-3xl font-800 text-dark">Bienvenue !</h3>
                  <p className="text-[13px] text-dark/40 leading-relaxed font-medium">
                    Dis-nous ton prénom pour commencer à discuter.
                  </p>
                </div>
                <div className="space-y-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitName()}
                    placeholder="Ton prénom..."
                    className="w-full rounded-2xl bg-white border border-dark/5 px-5 h-12 text-sm outline-none text-center shadow-sm focus:border-accent/30 focus:ring-4 focus:ring-accent/5 transition-all font-semibold"
                    autoFocus
                    inputMode="text"
                  />
                  <button
                    onClick={submitName}
                    disabled={!name.trim()}
                    className="w-full h-12 rounded-2xl bg-dark text-white text-sm font-900 shadow-xl shadow-dark/20 hover:bg-accent transition-all active:scale-[0.98] disabled:opacity-30 uppercase tracking-widest"
                  >
                    C'est parti
                  </button>
                  <p className="text-[10px] text-dark/30 text-center pt-1">
                    L'équipe répond en général en moins de 24h. Pour une réponse immédiate, passe par WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F9F9F9] custom-scrollbar overscroll-contain" ref={panelRef}>
                <div className="flex items-center justify-center">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-dark/25 bg-dark/5 px-3 py-1 rounded-full">
                    Aujourd'hui
                  </span>
                </div>

                {messages.map((msg) => {
                  const isClient = msg.sender === 'client';
                  const isAdmin = msg.sender === 'admin';
                  return (
                    <div key={msg.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-[20px] px-4 py-3 text-[13.5px] leading-relaxed shadow-sm ${
                          isClient
                            ? 'bg-dark text-white rounded-br-md'
                            : isAdmin
                              ? 'bg-accent text-white rounded-bl-md'
                              : 'bg-white text-dark rounded-bl-md border border-dark/[0.03]'
                        }`}
                      >
                        {isAdmin && (
                          <div className="text-[9px] font-black text-white/60 mb-1 uppercase tracking-tighter">
                            Support tof.
                          </div>
                        )}
                        {msg.sender === 'bot' && (
                          <div className="text-[9px] font-black text-dark/25 mb-1 uppercase tracking-tighter flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                            Assistant tof.
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                        <div className={`text-[9px] mt-2 font-bold opacity-40 ${isClient ? 'text-right' : 'text-left'}`}>
                          {formatTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {typing && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-dark/[0.03] rounded-[20px] rounded-bl-md px-5 py-3.5 flex items-center gap-1.5 shadow-sm">
                      <span className="h-1.5 w-1.5 bg-dark/30 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="h-1.5 w-1.5 bg-dark/30 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="h-1.5 w-1.5 bg-dark/30 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                )}

                {hasAdminReplied && !typing && (
                  <div className="flex justify-center">
                    <span className="text-[10px] font-bold text-accent/80 bg-accent/10 px-3 py-1 rounded-full">
                      Un membre de l'équipe a pris la main 👋
                    </span>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div className="bg-white border-t border-dark/5 p-3 sm:p-4 space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
                {(suggestions.length > 0) && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5 snap-x-mandatory">
                    {suggestions.map((s) => {
                      const isWpp = s.toLowerCase().includes('whatsapp');
                      const isShop = s.toLowerCase().includes('shop') || s.toLowerCase().includes('voir');
                      return (
                        <button
                          key={s}
                          onClick={() => onQuick(s)}
                          className={`rounded-full border px-4 py-2 text-[11px] font-bold whitespace-nowrap flex-shrink-0 snap-start transition-all active:scale-95 h-9 ${
                            isWpp
                              ? 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 hover:bg-[#25D366] hover:text-white'
                              : isShop
                                ? 'bg-dark text-white border-dark hover:bg-accent hover:border-accent'
                                : 'bg-[#F3F3F3] text-dark/70 border-dark/[0.04] hover:bg-dark hover:text-white'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void queueClientMessage(input);
                        }
                      }}
                      placeholder={hasAdminReplied ? "Répondre à l'équipe..." : "Écris ton message..."}
                      className="w-full rounded-2xl bg-[#F3F3F3] border border-transparent px-4 h-11 text-sm outline-none focus:bg-white focus:border-accent/20 focus:ring-4 focus:ring-accent/5 transition-all font-medium"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    onClick={() => void queueClientMessage(input)}
                    disabled={!input.trim()}
                    aria-label="Envoyer"
                    className="h-11 w-11 rounded-2xl bg-dark text-white flex items-center justify-center hover:bg-accent transition-all active:scale-90 disabled:opacity-30 shadow-lg shadow-dark/10 flex-shrink-0"
                  >
                    <Send size={18} strokeWidth={2.5} />
                  </button>
                </div>

                <p className="text-center text-[10px] text-dark/25">
                  Réponse rapide · Pour une urgence, passe par <a href={settings.whatsappUrl} target="_blank" rel="noreferrer" className="text-accent font-semibold underline-offset-2 hover:underline">WhatsApp</a>
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
