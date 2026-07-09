import { MessageCircle, Send, X, Minimize2, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { sendChatMessage, fetchConversationMessages, subscribeToChatMessages, type DbChatMessage } from '../lib/db';
import { readSiteSettings } from '../lib/siteSettings';

const CHAT_ID_KEY = 'tof-chat-id';
const CHAT_NAME_KEY = 'tof-chat-name';
const CHAT_OPEN_KEY = 'tof-chat-open';
const CHAT_WELCOMED_KEY = 'tof-chat-welcomed';

type BotRule = { keywords: string[]; reply: string; followUp?: string[] };

const botRules: BotRule[] = [
  {
    keywords: ['salut', 'bonjour', 'hello', 'yo', 'hey', 'wesh', 'slt', 'bjr', 'cc', 'coucou', 'bonsoir'],
    reply: "Salut ! Ravi de te voir sur tof. 🔥 Comment puis-je t'aider aujourd'hui ?",
    followUp: ['🛒 Comment commander ?', '📦 Délai de livraison', '💳 Moyens de paiement', '📐 Guide tailles'],
  },
  {
    keywords: ['prix', 'combien', 'coûte', 'coute', 'cher', 'tarif', 'budget', 'euro', '€', 'promo', 'réduction', 'code', 'solde'],
    reply: "Tous nos prix sont affichés directement sur les fiches produits, TVA incluse. 💸 On propose régulièrement des codes promo — abonne-toi sur Snap pour ne rien rater ! Pour un pack ou une pièce spécifique, passe par WhatsApp.",
    followUp: ['Voir le shop', 'Code promo ?'],
  },
  {
    keywords: ['livraison', 'delai', 'délai', 'combien de temps', 'expédition', 'expedition', 'recevoir', 'jours', 'semaine', 'quand', 'arrive', 'envoi', 'reçu'],
    reply: "🚀 Délais estimés (après paiement) :\n\n• Standard : 10-20 jours ouvrés\n• Express : 5-10 jours (avec supplément)\n\nDès l'expédition tu reçois ton numéro de suivi par message. 💌\n\nLe seuil de livraison offerte et les frais exacts sont calculés en direct dans le panier.",
    followUp: ["C'est suivi ?", 'Livraison gratuite ?', 'Express ?'],
  },
  {
    keywords: ['track', 'suivi', 'colis', 'suivre', 'numero', 'numéro', 'tracking'],
    reply: "Absolument ! 📍 Toutes nos expéditions sont suivies. Tu reçois un lien de tracking personnalisé dès que ton colis part. Pour une commande en cours, envoie-nous ton numéro TOF-XXXX sur WhatsApp.",
  },
  {
    keywords: ['gratuit', 'offert', 'livraison gratuite', 'frais', 'port', 'free'],
    reply: "Bonne nouvelle ! 🎉 La livraison standard est offerte dès le seuil affiché dans ton panier (sinon les frais sont calculés automatiquement au panier selon le mode choisi : Standard ou Express).",
  },
  {
    keywords: ['paiement', 'payer', 'paypal', 'virement', 'carte', 'cb', 'apple pay', 'revolut', 'moyen', 'régler', 'regler'],
    reply: "💳 Paiement 100% sécurisé via PayPal (Achat Protégé).\n\n1. Tu valides ton panier sur le site.\n2. On t'envoie la demande de paiement sur WhatsApp.\n3. Une fois payé, on prépare et expédie ton colis.\n\nBesoin d'un autre moyen ? Dis-nous !",
    followUp: ["C'est sécurisé ?", 'Contacter WhatsApp'],
  },
  {
    keywords: ['sécurisé', 'securise', 'confiance', 'arnaque', 'fiable', 'legit', 'vrai', 'faux', 'scam', 'sérieux', 'serieux', 'fiable'],
    reply: "On comprend les doutes, c'est normal ! Voilà pourquoi on est legit :\n\n✅ Photos QC (Qualité Contrôle) envoyées avant envoi\n✅ Paiement PayPal (protection acheteur)\n✅ Avis clients sur le site\n✅ Support réactif 7j/7\n\nZéro mauvaise surprise. ❤️",
  },
  {
    keywords: ['retour', 'rembours', 'échange', 'echange', 'problème', 'probleme', 'casse', 'abîme', 'abime', 'erreur', 'tromper', 'trompé'],
    reply: "Un souci ? Contacte-nous sous 14 jours avec ton numéro de commande :\n\n• Erreur de taille / article : échange ou remboursement\n• Article abîmé : remboursement immédiat\n\nOn veut que tu sois 100% satisfait. 🤝",
  },
  {
    keywords: ['taille', 'size', 'guide', 'mesure', 'pointure', 'grand', 'petit', 'taille bien', 'chausse', 'taille grand', 'taille petit'],
    reply: "📐 Conseils de tailles :\n\n• Sapes (S/M/L) : prends ta taille habituelle\n• Sneakers : TTS (True To Size)\n• Si entre deux tailles → prends la plus grande\n\nPour un modèle précis, demande-nous la mesure exacte en cm !",
    followUp: ['Voir le shop'],
  },
  {
    keywords: ['commande', 'commander', 'acheter', 'comment', 'étape', 'etape', 'processus', 'faire', 'commande'],
    reply: "C'est super simple : 🛍️\n\n1️⃣ Ajoute tes pièces au panier\n2️⃣ Remplis tes infos de livraison\n3️⃣ On te contacte sur WhatsApp pour le paiement PayPal\n4️⃣ Tu reçois le tracking à l'expédition\n\nC'est parti !",
    followUp: ['Voir le shop', '💳 Comment payer ?'],
  },
  {
    keywords: ['snap', 'snapchat', 'réseau', 'reseau', 'social', 'insta', 'instagram'],
    reply: "📸 Rejoins-nous sur Snap @tofh2b !\n\n• Drops en avant-première\n• Photos QC en direct\n• Codes promo exclusifs\n• Backstages",
  },
  {
    keywords: ['whatsapp', 'contact', 'joindre', 'appeler', 'telephone', 'tel', 'numéro', 'numero', 'humain', 'parler à'],
    reply: "💬 WhatsApp est le plus rapide pour nous joindre :\n\nClique sur le bouton \"💬 WhatsApp\" dans le menu, ou sur le bouton vert en bas de page.",
  },
  {
    keywords: ['marque', 'gucci', 'louis', 'vuitton', 'lv', 'prada', 'nike', 'jordan', 'dior', 'balenciaga', 'versace', 'burberry', 'off-white', 'off white', 'amiri', 'moncler', 'luxe', 'stone island'],
    reply: "On source le meilleur du luxe et du streetwear : Nike, Jordan, LV, Gucci, Prada, Dior, Balenciaga, Moncler, Stone Island... 💎\n\nTu cherches un modèle précis qui n'est pas sur le site ? Envoie-nous une photo — on peut sûrement te le trouver !",
    followUp: ['Voir le shop', 'Contacter WhatsApp'],
  },
  {
    keywords: ['merci', 'thanks', 'cool', 'top', 'parfait', 'super', 'nickel', 'genial', 'génial', 'ok', 'dac', "d'accord", 'oui', 'yes'],
    reply: "Avec plaisir ! 🔥 Profite bien de ta visite et n'hésite pas si tu as d'autres questions.",
    followUp: ['Voir le shop'],
  },
  {
    keywords: ['stock', 'disponible', 'dispo', 'rupture', 'en stock', 'reste'],
    reply: "📦 Toutes les pièces affichées sur le shop sont disponibles.\n\nSi un produit est en rupture, il disparaît du catalogue. Pour les drops à venir, suis-nous sur Snap !",
  },
  {
    keywords: ['qc', 'qualité', 'quality', 'photo', 'photos', 'authentique', 'authenticité'],
    reply: "🔍 Contrôle qualité systématique avant envoi :\n\n• Photos détaillées envoyées au client\n• Vérification coutures / logos / matières\n• Mesures précises sur demande\n\nOn expédie uniquement si c'est parfait.",
  },
  {
    keywords: ['express', 'rapide', 'vite', 'urgent'],
    reply: "⚡ Livraison Express 5-10 jours disponible au panier (avec supplément). Idéal pour un cadeau ou une sortie !",
  },
  {
    keywords: ['code promo', 'promo', 'code', 'réduc', 'reduc'],
    reply: "🎁 Des codes promo sont partagés régulièrement sur Snapchat @tofh2b et pour les nouveaux clients. Jette un œil !",
    followUp: ['Aller sur Snap'],
  },
];

const quickButtons = [
  { label: '🛒 Commander', text: 'Comment commander ?' },
  { label: '📦 Livraison', text: 'Quel est le délai de livraison ?' },
  { label: '💳 Paiement', text: 'Comment payer ?' },
  { label: '📐 Tailles', text: 'Guide des tailles' },
  { label: '🏷️ Marques', text: 'Quelles marques vous avez ?' },
  { label: '💬 WhatsApp', text: 'Comment vous contacter sur WhatsApp ?' },
];

function normalize(str: string) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getBotReply(message: string): { reply: string; followUp?: string[] } | null {
  const lower = normalize(message);
  for (const rule of botRules) {
    if (rule.keywords.some((k) => lower.includes(normalize(k)))) {
      return { reply: rule.reply, followUp: rule.followUp };
    }
  }
  return null;
}

function getConversationId() {
  let id = localStorage.getItem(CHAT_ID_KEY);
  if (!id) {
    id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(CHAT_ID_KEY, id);
  }
  return id;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const WELCOMED_TEXTS = [
  "Hey, content de te revoir ! 👋 Je suis ton assistant tof. Une question sur une pièce, une commande ou une taille ?",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(() => {
    try { return sessionStorage.getItem(CHAT_OPEN_KEY) === '1'; } catch { return false; }
  });
  const [messages, setMessages] = useState<DbChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState(() => localStorage.getItem(CHAT_NAME_KEY) || '');
  const [nameSet, setNameSet] = useState(() => !!localStorage.getItem(CHAT_NAME_KEY));
  const [unread, setUnread] = useState(0);
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showPulse, setShowPulse] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragStart, setDragStart] = useState<{ y: number; scrollTop: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const conversationId = useMemo(() => getConversationId(), []);
  const settings = useMemo(() => readSiteSettings(), []);
  const hasAdminReplied = useMemo(() => messages.some((m) => m.sender === 'admin'), [messages]);

  // Persist open state
  useEffect(() => {
    try { sessionStorage.setItem(CHAT_OPEN_KEY, open ? '1' : '0'); } catch {}
  }, [open]);

  // Lock scroll on mobile when open
  useEffect(() => {
    const isMobile = window.innerWidth < 640;
    if (open && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Show pulse hint after a few seconds (only if not yet welcomed this session)
  useEffect(() => {
    if (open) return;
    const hasOpenedThisSession = sessionStorage.getItem(CHAT_WELCOMED_KEY);
    if (hasOpenedThisSession) return;
    const t = setTimeout(() => setShowPulse(true), 8000);
    return () => clearTimeout(t);
  }, [open]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const data = await fetchConversationMessages(conversationId);
      setMessages((prev) => {
        if (!open && data.length > prev.length) {
          setUnread((u) => u + (data.length - prev.length));
        }
        return data;
      });
      scrollToBottom();
    } catch {}
  }, [conversationId, open, scrollToBottom]);

  useEffect(() => {
    if (nameSet) loadMessages();
    const unsub = subscribeToChatMessages(() => loadMessages());
    return () => unsub();
  }, [nameSet, loadMessages]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      scrollToBottom();
      try { sessionStorage.setItem(CHAT_WELCOMED_KEY, '1'); } catch {}
      setShowPulse(false);
    }
  }, [open, messages.length, scrollToBottom]);

  const sendWelcome = async (userName: string, isReturn = false) => {
    const text = isReturn
      ? WELCOMED_TEXTS[Math.floor(Math.random() * WELCOMED_TEXTS.length)]
      : `Salut ${userName} ! 👋 Bienvenue sur tof.\n\nJe suis ton assistant. Tu peux me poser une question ou cliquer sur un bouton ci-dessous.`;
    const msg: DbChatMessage = {
      id: `m-${Date.now()}`,
      conversation_id: conversationId,
      sender: 'bot',
      message: text,
      client_name: userName,
    };
    setMessages([msg]);
    await sendChatMessage(msg).catch(() => {});
    setSuggestions(quickButtons.map((b) => b.label));
  };

  const submitName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem(CHAT_NAME_KEY, trimmed);
    setName(trimmed);
    setNameSet(true);
    await sendWelcome(trimmed, false);
  };

  // If returning user with no messages in DB yet, inject welcome back
  useEffect(() => {
    if (nameSet && messages.length === 0) {
      sendWelcome(name || 'toi', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameSet, messages.length]);

  const processMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !nameSet) return;
      setInput('');
      setSuggestions([]);

      const clientMsg: DbChatMessage = {
        id: `m-${Date.now()}`,
        conversation_id: conversationId,
        sender: 'client',
        message: text.trim(),
        client_name: name,
      };
      setMessages((prev) => [...prev, clientMsg]);
      sendChatMessage(clientMsg).catch(() => {});
      scrollToBottom();

      // If admin already replied, let human handle it
      if (hasAdminReplied) return;

      const botResult = getBotReply(text);

      const reply = botResult
        ? botResult.reply
        : "Bonne question ! Je n'ai pas la réponse exacte tout de suite, mais notre équipe a été notifiée et te répondra ici-même très rapidement. 💬 En attendant, tu peux aussi nous contacter directement sur WhatsApp.";

      setTyping(true);
      const delay = 700 + Math.random() * (botResult ? 700 : 900);
      setTimeout(async () => {
        const botMsg: DbChatMessage = {
          id: `m-${Date.now()}-bot`,
          conversation_id: conversationId,
          sender: botResult ? 'bot' : 'bot',
          message: reply,
          client_name: name,
        };
        setMessages((prev) => [...prev, botMsg]);
        sendChatMessage(botMsg).catch(() => {});
        setTyping(false);
        setSuggestions(botResult?.followUp?.length ? botResult.followUp : ['Contacter WhatsApp', 'Voir le shop']);
        scrollToBottom();
      }, delay);
    },
    [conversationId, hasAdminReplied, name, nameSet, scrollToBottom],
  );

  // Handle quick button click
  const onQuick = (label: string) => {
    const found = quickButtons.find((b) => b.label === label);
    processMessage(found ? found.text : label);
  };

  // Drag-to-close on mobile
  const onTouchStart = (e: React.TouchEvent) => {
    const scroller = panelRef.current;
    if (!scroller || scroller.scrollTop > 0) {
      setDragStart(null);
      return;
    }
    setDragStart({ y: e.touches[0].clientY, scrollTop: scroller.scrollTop });
    setDragY(0);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragStart) return;
    const dy = e.touches[0].clientY - dragStart.y;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 120) {
      setOpen(false);
    }
    setDragY(0);
    setDragStart(null);
  };

  const resetChat = () => {
    if (!confirm("Effacer la conversation sur cet appareil ?")) return;
    try {
      localStorage.removeItem(CHAT_ID_KEY);
      localStorage.removeItem(CHAT_NAME_KEY);
      sessionStorage.removeItem(CHAT_OPEN_KEY);
    } catch {}
    setName('');
    setNameSet(false);
    setMessages([]);
    setInput('');
    setSuggestions([]);
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
            className={`relative h-14 w-14 rounded-full bg-accent text-white shadow-2xl shadow-accent/30 flex items-center justify-center hover:bg-accent-light active:scale-95 transition-all ${
              showPulse ? 'anim-pulse-ring' : ''
            }`}
          >
            <MessageCircle size={24} strokeWidth={2.5} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-h-5 min-w-5 px-1 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-bounce">
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
                  <span className="text-[10px] text-white/50 uppercase tracking-[0.15em] font-bold">En ligne</span>
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
                  <p className="text-[13px] text-dark/40 leading-relaxed font-medium">Dis-nous ton prénom pour commencer à discuter.</p>
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
                    On répond en général en moins de 24h. Pour une réponse immédiate, passe par WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F9F9F9] custom-scrollbar chat-scroll overscroll-contain" ref={panelRef}>
                {/* Welcome day divider */}
                <div className="flex items-center justify-center">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-dark/25 bg-dark/5 px-3 py-1 rounded-full">
                    Aujourd'hui
                  </span>
                </div>

                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-[20px] px-4 py-3 text-[13.5px] leading-relaxed shadow-sm ${
                        msg.sender === 'client'
                          ? 'bg-dark text-white rounded-br-md'
                          : msg.sender === 'admin'
                            ? 'bg-accent text-white rounded-bl-md'
                            : 'bg-white text-dark rounded-bl-md border border-dark/[0.03]'
                      }`}
                    >
                      {msg.sender === 'admin' && (
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
                      <div className={`text-[9px] mt-2 font-bold opacity-40 ${msg.sender === 'client' ? 'text-right' : 'text-left'}`}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))}

                {typing && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-dark/[0.03] rounded-[20px] rounded-bl-md px-5 py-3.5 flex items-center gap-1.5 shadow-sm">
                      <span className="h-1.5 w-1.5 bg-dark/30 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="h-1.5 w-1.5 bg-dark/30 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="h-1.5 w-1.5 bg-dark/30 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Suggestions + input */}
              <div className="bg-white border-t border-dark/5 p-3 sm:p-4 space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
                {(suggestions.length > 0 || messages.length <= 1) && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5 snap-x-mandatory">
                    {(suggestions.length > 0 ? suggestions : quickButtons.map((b) => b.label)).map((s) => {
                      const isWpp = s.toLowerCase().includes('whatsapp');
                      const isShop = s.toLowerCase().includes('shop') || s.toLowerCase().includes('voir');
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            if (s.toLowerCase().includes('whatsapp')) {
                              window.open(settings.whatsappUrl, '_blank', 'noreferrer');
                              return;
                            }
                            if (s.toLowerCase().includes('snap')) {
                              window.open(settings.snapchatUrl, '_blank', 'noreferrer');
                              return;
                            }
                            if (isShop) {
                              setOpen(false);
                              window.location.hash = '#shop';
                              return;
                            }
                            onQuick(s);
                          }}
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
                          processMessage(input);
                        }
                      }}
                      placeholder="Écris ton message..."
                      className="w-full rounded-2xl bg-[#F3F3F3] border border-transparent px-4 h-11 text-sm outline-none focus:bg-white focus:border-accent/20 focus:ring-4 focus:ring-accent/5 transition-all font-medium"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    onClick={() => processMessage(input)}
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
