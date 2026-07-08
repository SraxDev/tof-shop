import { MessageCircle, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { sendChatMessage, fetchConversationMessages, subscribeToChatMessages, type DbChatMessage } from '../lib/db';

const CHAT_ID_KEY = 'tof-chat-id';
const CHAT_NAME_KEY = 'tof-chat-name';

const botReplies: { keywords: string[]; reply: string }[] = [
  { keywords: ['salut', 'bonjour', 'hello', 'yo', 'hey', 'wesh'], reply: "Salut ! Bienvenue sur tof. 🔥 Comment je peux t'aider ?" },
  { keywords: ['prix', 'combien', 'coûte', 'coute', 'cher'], reply: "Tu peux voir les prix directement dans le shop. Si tu veux un prix sur un article spécifique, dis-moi lequel !" },
  { keywords: ['livraison', 'delai', 'délai', 'combien de temps', 'expédition', 'expedition'], reply: "La livraison prend entre 7 et 20 jours selon la ligne choisie. Tu recevras ton tracking sur WhatsApp dès l'expédition." },
  { keywords: ['paiement', 'payer', 'paypal', 'virement'], reply: "On accepte le paiement via PayPal. Tu commandes sur le site, puis tu finalises le paiement sur WhatsApp." },
  { keywords: ['retour', 'rembours', 'échange', 'echange', 'problème', 'probleme'], reply: "Si tu as un souci avec ta commande, contacte-nous sur WhatsApp et on règle ça ensemble. On fait toujours au mieux !" },
  { keywords: ['taille', 'size', 'guide'], reply: "Les tailles sont indiquées sur chaque produit. En cas de doute, prends ta taille habituelle. Pour les sneakers, ça taille normalement." },
  { keywords: ['commande', 'commander', 'acheter'], reply: "Pour commander : choisis ton article → ajoute au panier → valide → finalise sur WhatsApp. C'est simple et rapide !" },
  { keywords: ['snap', 'snapchat', 'whatsapp', 'contact'], reply: "Tu peux nous contacter sur Snap : @tofh2b ou sur WhatsApp. Les liens sont en bas du site !" },
  { keywords: ['marque', 'gucci', 'louis', 'prada', 'nike', 'jordan', 'dior', 'balenciaga'], reply: "On propose les plus grandes marques : Gucci, LV, Prada, Nike, Jordan, Dior, Balenciaga et bien d'autres. Check le shop !" },
  { keywords: ['merci', 'thanks', 'cool', 'top', 'parfait'], reply: "Avec plaisir ! N'hésite pas si tu as d'autres questions 💪" },
];

function getBotReply(message: string): string | null {
  const lower = message.toLowerCase();
  for (const { keywords, reply } of botReplies) {
    if (keywords.some((k) => lower.includes(k))) return reply;
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationId = getConversationId();

  const loadMessages = async () => {
    const data = await fetchConversationMessages(conversationId);
    const prevCount = messages.length;
    setMessages(data);
    if (!open && data.length > prevCount) {
      setUnread((prev) => prev + (data.length - prevCount));
    }
  };

  useEffect(() => {
    if (nameSet) loadMessages();
    const unsub = subscribeToChatMessages(() => loadMessages());
    return () => unsub();
  }, [nameSet]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages.length]);

  const submitName = () => {
    if (!name.trim()) return;
    localStorage.setItem(CHAT_NAME_KEY, name.trim());
    setNameSet(true);

    const welcomeMsg: DbChatMessage = {
      id: `m-${Date.now()}`,
      conversation_id: conversationId,
      sender: 'bot',
      message: `Salut ${name.trim()} ! Bienvenue sur tof. 🔥\nPose-moi ta question et je t'aide. Si je ne peux pas répondre, l'équipe te répondra directement.`,
      client_name: name.trim(),
    };
    sendChatMessage(welcomeMsg);
    setMessages([welcomeMsg]);
  };

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');

    const clientMsg: DbChatMessage = {
      id: `m-${Date.now()}`,
      conversation_id: conversationId,
      sender: 'client',
      message: text,
      client_name: name,
    };
    setMessages((prev) => [...prev, clientMsg]);
    await sendChatMessage(clientMsg);

    const botReply = getBotReply(text);
    if (botReply) {
      setTimeout(async () => {
        const botMsg: DbChatMessage = {
          id: `m-${Date.now()}-bot`,
          conversation_id: conversationId,
          sender: 'bot',
          message: botReply,
          client_name: name,
        };
        setMessages((prev) => [...prev, botMsg]);
        await sendChatMessage(botMsg);
      }, 600);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[70] h-14 w-14 rounded-full bg-accent text-white shadow-2xl shadow-accent/30 flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageCircle size={24} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">{unread}</span>
          )}
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[80] w-full sm:w-96 h-[100dvh] sm:h-[520px] bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-dark/5">
          {/* Header */}
          <div className="bg-dark text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="font-display font-800 text-lg">tof<span className="text-accent">.</span> chat</div>
              <div className="text-xs text-white/40 flex items-center gap-1.5">
                <span className="h-2 w-2 bg-green-400 rounded-full" />
                En ligne
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {!nameSet ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center space-y-4 w-full">
                <div className="text-3xl">👋</div>
                <h3 className="font-display text-xl font-800 text-dark">Bienvenue !</h3>
                <p className="text-sm text-dark/40">Dis-nous ton prénom pour commencer</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitName()}
                  placeholder="Ton prénom"
                  className="w-full rounded-xl bg-bg px-4 py-3 text-sm outline-none text-center"
                  autoFocus
                />
                <button onClick={submitName} className="w-full rounded-full bg-dark text-white py-3 text-sm font-bold hover:bg-accent transition-colors">
                  Commencer
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.sender === 'client'
                        ? 'bg-dark text-white rounded-br-md'
                        : msg.sender === 'admin'
                          ? 'bg-accent text-white rounded-bl-md'
                          : 'bg-bg text-dark rounded-bl-md'
                    }`}>
                      {msg.sender === 'admin' && (
                        <div className="text-[10px] font-bold text-white/60 mb-1">tof.</div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                      <div className={`text-[10px] mt-1 ${msg.sender === 'client' ? 'text-white/30' : msg.sender === 'admin' ? 'text-white/40' : 'text-dark/25'}`}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-dark/5 p-3 flex gap-2 flex-shrink-0 safe-bottom">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Écris ton message..."
                  className="flex-1 rounded-xl bg-bg px-4 py-3 text-sm outline-none"
                  autoFocus
                />
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="h-11 w-11 rounded-xl bg-dark text-white flex items-center justify-center hover:bg-accent transition-colors disabled:opacity-30"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
