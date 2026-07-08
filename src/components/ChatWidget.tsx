import { MessageCircle, Send, X } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { sendChatMessage, fetchConversationMessages, subscribeToChatMessages, type DbChatMessage } from '../lib/db';

const CHAT_ID_KEY = 'tof-chat-id';
const CHAT_NAME_KEY = 'tof-chat-name';

// ─── Bot intelligence ────────────────────────────────────

type BotRule = { keywords: string[]; reply: string; followUp?: string[] };

const botRules: BotRule[] = [
  { keywords: ['salut', 'bonjour', 'hello', 'yo', 'hey', 'wesh', 'slt', 'bjr', 'cc', 'coucou'],
    reply: "Salut ! Ravi de te voir sur tof. 🔥 Comment puis-je t'aider aujourd'hui ?",
    followUp: ['🛒 Comment commander ?', '📦 Délai de livraison', '💳 Moyens de paiement'] },

  { keywords: ['prix', 'combien', 'coûte', 'coute', 'cher', 'tarif', 'budget', 'euro', '€'],
    reply: "Tous nos prix sont indiqués directement sur les fiches produits. Ils incluent déjà les taxes. Si tu as un budget spécifique ou si tu cherches un pack, on peut en discuter sur WhatsApp ! 💸" },

  { keywords: ['livraison', 'delai', 'délai', 'combien de temps', 'expédition', 'expedition', 'recevoir', 'jours', 'semaine', 'quand', 'arrive', 'envoi'],
    reply: "🚀 On sait que tu as hâte ! Voici nos délais :\n\n• Standard : 10-15 jours ouvrés\n• Express : 7-10 jours (idéal pour les cadeaux)\n\nDès que ton colis quitte l'entrepôt, tu reçois ton numéro de suivi par message. 😉",
    followUp: ['C\'est suivi ?', 'Livraison gratuite ?'] },

  { keywords: ['track', 'suivi', 'colis', 'suivre', 'numero', 'numéro'],
    reply: "Absolument ! Toutes nos expéditions sont suivies. Tu recevras un lien de tracking personnalisé dès que ta commande sera en route. 📍" },

  { keywords: ['gratuit', 'offert', 'livraison gratuite', 'frais', 'port'],
    reply: "Bonne nouvelle ! La livraison standard est offerte pour toute commande supérieure à 100€. 🎉" },

  { keywords: ['paiement', 'payer', 'paypal', 'virement', 'carte', 'cb', 'apple pay', 'revolut', 'moyen'],
    reply: "💳 Pour ta sécurité, on privilégie PayPal. C'est simple :\n\n1. Tu valides ton panier sur le site.\n2. On t'envoie les infos de paiement sur WhatsApp.\n3. Une fois payé, on prépare ton colis immédiatement.\n\nBesoin d'un autre moyen ? Demande-nous ! 💬",
    followUp: ['C\'est sécurisé ?', 'Contacter WhatsApp'] },

  { keywords: ['sécurisé', 'securise', 'confiance', 'arnaque', 'fiable', 'legit', 'vrai', 'faux', 'scam', 'sérieux', 'serieux'],
    reply: "On comprend tes doutes ! On travaille dur pour votre satisfaction : \n✅ Avis clients vérifiables\n✅ Photos QC (Qualité) envoyées avant envoi\n✅ Support réactif 7j/7\nOn ne te laisse jamais sans réponse. ❤️" },

  { keywords: ['retour', 'rembours', 'échange', 'echange', 'problème', 'probleme', 'casse', 'abîme', 'abime', 'erreur', 'tromper'],
    reply: "Une erreur de taille ou un article abîmé ? Pas de panique. Contacte-nous sous 14 jours avec ton numéro de commande et on règle ça ensemble (remplacement ou remboursement). On veut que tu sois 100% satisfait. 🤝" },

  { keywords: ['taille', 'size', 'guide', 'mesure', 'pointure', 'grand', 'petit', 'taille bien', 'chausse'],
    reply: "📐 On conseille généralement de prendre ta taille habituelle.\n\n• Sneakers : TTS (True To Size).\n• Sapes : Coupe standard européenne.\n\nSi tu es entre deux tailles, choisis la plus grande pour plus de confort. Besoin de mesures précises ? Contacte-nous ! 📏" },

  { keywords: ['commande', 'commander', 'acheter', 'comment', 'étape', 'etape', 'processus', 'faire'],
    reply: "C'est très simple :\n1️⃣ Ajoute tes coups de cœur au panier.\n2️⃣ Remplis tes infos de livraison.\n3️⃣ On te contacte sur WhatsApp pour le paiement.\n4️⃣ On expédie et tu kiffes ! 🛍️",
    followUp: ['Voir le shop', '💳 Comment payer ?'] },

  { keywords: ['snap', 'snapchat', 'réseau', 'reseau', 'social', 'insta', 'instagram'],
    reply: "Suis-nous pour ne rien rater ! 📸\nSnapchat : @tofh2b (exclus & drops)\nOn y poste les nouveautés en avant-première ! ✨" },

  { keywords: ['whatsapp', 'contact', 'joindre', 'appeler', 'telephone', 'tel', 'numéro', 'numero'],
    reply: "💬 Notre support WhatsApp est le moyen le plus rapide de nous joindre. Tu peux cliquer sur le bouton vert en bas à droite du site !" },

  { keywords: ['marque', 'gucci', 'louis', 'vuitton', 'prada', 'nike', 'jordan', 'dior', 'balenciaga', 'versace', 'burberry', 'off-white', 'amiri', 'moncler', 'luxe'],
    reply: "On source le meilleur du luxe et du streetwear : Nike, Jordan, LV, Gucci, Prada... 💎\n\nTu cherches un modèle précis qui n'est pas sur le site ? Envoie-nous une photo, on peut sûrement te le trouver !" },

  { keywords: ['merci', 'thanks', 'cool', 'top', 'parfait', 'super', 'nickel', 'genial', 'génial', 'ok', 'dac', 'd\'accord'],
    reply: "Avec grand plaisir ! Profite bien de ta visite sur tof. 💪🔥",
    followUp: ['Voir le shop'] },
];

const quickButtons = [
  { label: '🛒 Comment commander ?', text: 'Comment commander ?' },
  { label: '📦 Délai livraison', text: 'Quel est le délai de livraison ?' },
  { label: '💳 Comment payer ?', text: 'Comment payer ?' },
  { label: '📐 Guide tailles', text: 'Guide des tailles' },
  { label: '🏷️ Les marques', text: 'Quelles marques vous avez ?' },
  { label: '💬 Contacter WhatsApp', text: 'Comment vous contacter sur WhatsApp ?' },
];

function getBotReply(message: string): { reply: string; followUp?: string[] } | null {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const rule of botRules) {
    if (rule.keywords.some((k) => lower.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
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

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DbChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState(() => localStorage.getItem(CHAT_NAME_KEY) || '');
  const [nameSet, setNameSet] = useState(() => !!localStorage.getItem(CHAT_NAME_KEY));
  const [unread, setUnread] = useState(0);
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationId = getConversationId();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const loadMessages = useCallback(async () => {
    const data = await fetchConversationMessages(conversationId);
    setMessages((prev) => {
      if (!open && data.length > prev.length) {
        setUnread((u) => u + (data.length - prev.length));
      }
      return data;
    });
    scrollToBottom();
  }, [conversationId, open, scrollToBottom]);

  useEffect(() => {
    if (nameSet) loadMessages();
    const unsub = subscribeToChatMessages(() => loadMessages());
    return () => unsub();
  }, [nameSet, loadMessages]);

  useEffect(() => {
    if (open) { setUnread(0); scrollToBottom(); }
  }, [open, messages.length, scrollToBottom]);

  const submitName = async () => {
    if (!name.trim()) return;
    localStorage.setItem(CHAT_NAME_KEY, name.trim());
    setNameSet(true);
    const welcomeMsg: DbChatMessage = {
      id: `m-${Date.now()}`,
      conversation_id: conversationId,
      sender: 'bot',
      message: `Salut ${name.trim()} ! 👋 Bienvenue sur tof.\n\nJe suis là pour t'aider. Tu peux me poser une question ou utiliser les boutons ci-dessous.`,
      client_name: name.trim(),
    };
    await sendChatMessage(welcomeMsg);
    setMessages([welcomeMsg]);
    setSuggestions(['Comment commander ?', 'Délai de livraison', 'Comment payer ?', 'Les marques']);
  };

  const processMessage = async (text: string) => {
    if (!text.trim()) return;
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
    await sendChatMessage(clientMsg);
    scrollToBottom();

    // Vérifier si un administrateur a déjà répondu dans cette conversation
    const hasAdminReplied = messages.some(m => m.sender === 'admin');
    
    // Si un humain a déjà pris le relais, le bot reste silencieux
    if (hasAdminReplied) return;

    const botResult = getBotReply(text);
    if (botResult) {
      setTyping(true);
      setTimeout(async () => {
        const botMsg: DbChatMessage = {
          id: `m-${Date.now()}-bot`,
          conversation_id: conversationId,
          sender: 'bot',
          message: botResult.reply,
          client_name: name,
        };
        setMessages((prev) => [...prev, botMsg]);
        await sendChatMessage(botMsg);
        setTyping(false);
        if (botResult.followUp) setSuggestions(botResult.followUp);
        scrollToBottom();
      }, 800 + Math.random() * 600);
    } else {
      setTyping(true);
      setTimeout(async () => {
        const fallbackMsg: DbChatMessage = {
          id: `m-${Date.now()}-bot`,
          conversation_id: conversationId,
          sender: 'bot',
          message: "Je n'ai pas la réponse exacte, mais notre équipe support a été notifiée et va te répondre ici-même très rapidement ! ✨",
          client_name: name,
        };
        setMessages((prev) => [...prev, fallbackMsg]);
        await sendChatMessage(fallbackMsg);
        setTyping(false);
        setSuggestions(['Comment commander ?', 'Délai de livraison', 'Contacter WhatsApp']);
        scrollToBottom();
      }, 1000);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[70] h-14 w-14 rounded-full bg-accent text-white shadow-2xl shadow-accent/30 flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageCircle size={24} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse">{unread}</span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-[80] w-full sm:w-96 h-[100dvh] sm:h-[600px] bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden sm:border border-dark/5 anim-slide-up">
          {/* Header */}
          <div className="bg-dark text-white px-5 py-4 flex items-center justify-between flex-shrink-0 safe-top">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xl font-bold border border-accent/10">
                  t.
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border-2 border-dark" />
              </div>
              <div>
                <div className="font-display font-800 text-base">tof<span className="text-accent">.</span> Support</div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Réponse instantanée</div>
              </div>
            </div>
            <button 
              onClick={() => setOpen(false)} 
              className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            >
              <X size={20} />
            </button>
          </div>

          {!nameSet ? (
            <div className="flex-1 flex items-center justify-center p-8 bg-bg/30">
              <div className="text-center space-y-6 w-full max-w-[280px]">
                <div className="h-20 w-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-4xl mx-auto anim-float">👋</div>
                <div>
                  <h3 className="font-display text-2xl font-800 text-dark">Hello !</h3>
                  <p className="text-sm text-dark/40 mt-1 leading-relaxed">Prêt à trouver ta pièce ? Donne-nous ton prénom.</p>
                </div>
                <div className="space-y-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitName()}
                    placeholder="Ton prénom..."
                    className="w-full rounded-2xl bg-white border border-dark/5 px-5 py-4 text-sm outline-none text-center shadow-sm focus:border-accent/20 transition-all"
                    autoFocus
                  />
                  <button 
                    onClick={submitName} 
                    disabled={!name.trim()}
                    className="w-full rounded-2xl bg-dark text-white py-4 text-sm font-bold shadow-lg shadow-dark/10 hover:bg-accent transition-all active:scale-[0.98] disabled:opacity-30"
                  >
                    Lancer la discussion
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg/20 custom-scrollbar">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-[20px] px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      msg.sender === 'client'
                        ? 'bg-dark text-white rounded-br-sm'
                        : msg.sender === 'admin'
                          ? 'bg-accent text-white rounded-bl-sm'
                          : 'bg-white text-dark rounded-bl-sm border border-dark/5'
                    }`}>
                      {msg.sender === 'admin' && <div className="text-[10px] font-bold text-white/50 mb-1 uppercase tracking-tighter">Support tof.</div>}
                      {msg.sender === 'bot' && <div className="text-[10px] font-bold text-dark/20 mb-1 uppercase tracking-tighter">Assistant virtuel</div>}
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                      <div className={`text-[9px] mt-2 font-medium opacity-40 ${msg.sender === 'client' ? 'text-right' : 'text-left'}`}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))}

                {typing && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-dark/5 rounded-[20px] rounded-bl-sm px-5 py-4 flex items-center gap-1.5 shadow-sm">
                      <span className="h-1.5 w-1.5 bg-dark/20 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="h-1.5 w-1.5 bg-dark/20 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="h-1.5 w-1.5 bg-dark/20 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Suggestions & Input Area */}
              <div className="bg-white border-t border-dark/5 p-3 sm:p-4 space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
                
                {/* Scrollable Suggestions */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                  {(suggestions.length > 0 ? suggestions : (messages.length <= 2 ? quickButtons.map(b => b.label) : [])).map((s) => (
                    <button
                      key={s}
                      onClick={() => processMessage(s.includes('🛒') || s.includes('📦') ? quickButtons.find(b => b.label === s)?.text || s : s)}
                      className="rounded-full bg-bg border border-dark/[0.03] text-dark/60 px-4 py-2 text-[11px] font-bold whitespace-nowrap flex-shrink-0 hover:bg-dark hover:text-white transition-all active:scale-95"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && processMessage(input)}
                      placeholder="Ta question..."
                      className="w-full rounded-2xl bg-bg border border-dark/[0.03] px-5 py-4 text-sm outline-none focus:bg-white focus:border-accent/20 transition-all shadow-inner"
                    />
                  </div>
                  <button
                    onClick={() => processMessage(input)}
                    disabled={!input.trim()}
                    className="h-14 w-14 rounded-2xl bg-dark text-white flex items-center justify-center hover:bg-accent transition-all active:scale-[0.9] disabled:opacity-10 shadow-lg"
                  >
                    <Send size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
