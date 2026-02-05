'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  Send,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Search,
  Clock,
  CheckCircle,
  User,
  Headphones,
  Bot,
  ArrowLeft
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';

// ============================================
// TYPES
// ============================================
interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'admin' | 'bot';
  timestamp: Date;
  read?: boolean;
}

interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: 'open' | 'closed';
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// FAQ DATA
// ============================================
const faqs: FAQ[] = [
  // Account & Registration
  {
    id: '1',
    question: 'How do I create an account?',
    answer: 'Click on "Sign Up" on the homepage, enter your email, create a password, and complete the verification process. You\'ll need to verify your email and complete KYC to start trading.',
    category: 'Account'
  },
  {
    id: '2',
    question: 'How do I reset my password?',
    answer: 'Click on "Forgot Password" on the login page, enter your email address, and we\'ll send you a reset link. Follow the instructions in the email to create a new password.',
    category: 'Account'
  },
  {
    id: '3',
    question: 'Why is my account not verified?',
    answer: 'Account verification requires completing KYC (Know Your Customer). Go to Settings > KYC Verification and submit your ID documents. Verification typically takes 1-2 business days.',
    category: 'Account'
  },
  // Deposits
  {
    id: '4',
    question: 'How do I make a deposit?',
    answer: 'Go to Dashboard > Wallet > Deposit. Select your preferred payment method (crypto, bank transfer, or payment processor), enter the amount, and follow the instructions. Upload payment proof if required.',
    category: 'Deposits'
  },
  {
    id: '5',
    question: 'What is the minimum deposit amount?',
    answer: 'The minimum deposit varies by method: Crypto deposits start at $50, Bank transfers at $100, and payment processors at $50. Check the Deposit page for specific minimums.',
    category: 'Deposits'
  },
  {
    id: '6',
    question: 'How long do deposits take to process?',
    answer: 'Crypto deposits are typically confirmed within 10-30 minutes (depending on network congestion). Bank transfers take 1-3 business days. Payment processor deposits are usually instant to 24 hours.',
    category: 'Deposits'
  },
  {
    id: '7',
    question: 'My deposit is pending. What should I do?',
    answer: 'Pending deposits are being reviewed by our team. Ensure you\'ve uploaded payment proof if required. If it\'s been more than 24 hours, contact support with your transaction reference.',
    category: 'Deposits'
  },
  // Trading
  {
    id: '8',
    question: 'How do I start trading?',
    answer: 'First, make a deposit to fund your account. Then go to Dashboard > Trade and select Crypto, Forex, or Stocks. Choose an asset, enter your trade amount, set stop-loss/take-profit if desired, and execute your trade.',
    category: 'Trading'
  },
  {
    id: '9',
    question: 'What is leverage and how does it work?',
    answer: 'Leverage allows you to trade with more capital than you have. For example, 10x leverage on $100 lets you control $1,000. While this amplifies profits, it also amplifies losses. Use leverage carefully.',
    category: 'Trading'
  },
  {
    id: '10',
    question: 'What are stop-loss and take-profit?',
    answer: 'Stop-loss automatically closes your trade at a set price to limit losses. Take-profit closes your trade when it reaches your target profit. Both help manage risk and lock in gains.',
    category: 'Trading'
  },
  {
    id: '11',
    question: 'Why was my trade liquidated?',
    answer: 'Trades are liquidated when losses exceed your margin. This happens when the market moves significantly against your position. Use stop-losses and appropriate leverage to prevent liquidation.',
    category: 'Trading'
  },
  // Withdrawals
  {
    id: '12',
    question: 'How do I withdraw funds?',
    answer: 'Go to Dashboard > Wallet > Withdraw. Select your withdrawal method, enter the amount and destination details, and submit. Withdrawals are processed within 1-3 business days after verification.',
    category: 'Withdrawals'
  },
  {
    id: '13',
    question: 'What are the withdrawal fees?',
    answer: 'Withdrawal fees vary by method. Crypto withdrawals have network fees, bank transfers have a flat fee, and payment processors may have percentage-based fees. Check the Withdrawal page for current fees.',
    category: 'Withdrawals'
  },
  {
    id: '14',
    question: 'Why is my withdrawal delayed?',
    answer: 'Withdrawals require verification for security. Large withdrawals may require additional review. Ensure your KYC is complete and your withdrawal address/details are correct.',
    category: 'Withdrawals'
  },
  // Copy Trading
  {
    id: '15',
    question: 'What is copy trading?',
    answer: 'Copy trading allows you to automatically replicate trades made by experienced traders. When they trade, your account mirrors their positions proportionally to your allocated capital.',
    category: 'Copy Trading'
  },
  {
    id: '16',
    question: 'How do I start copy trading?',
    answer: 'Go to Dashboard > Copy Trading, browse available traders, review their performance, and click "Copy" on a trader you want to follow. Set your copy amount and the system handles the rest.',
    category: 'Copy Trading'
  },
  // Security
  {
    id: '17',
    question: 'How is my account secured?',
    answer: 'We use industry-standard encryption, two-factor authentication (2FA), and cold storage for funds. Enable 2FA in Settings > Security for maximum protection.',
    category: 'Security'
  },
  {
    id: '18',
    question: 'I think my account was compromised. What do I do?',
    answer: 'Immediately change your password, enable 2FA if not already active, and contact support. We\'ll investigate and help secure your account. Review your recent activity for unauthorized actions.',
    category: 'Security'
  }
];

const faqCategories = ['All', 'Account', 'Deposits', 'Trading', 'Withdrawals', 'Copy Trading', 'Security'];

// ============================================
// SUPPORT WIDGET STORE (for persistence)
// ============================================
const getSupportTicket = (): SupportTicket | null => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('novatrade_support_ticket');
  if (stored) {
    const ticket = JSON.parse(stored);
    ticket.messages = ticket.messages.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }));
    ticket.createdAt = new Date(ticket.createdAt);
    ticket.updatedAt = new Date(ticket.updatedAt);
    return ticket;
  }
  return null;
};

const saveSupportTicket = (ticket: SupportTicket) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('novatrade_support_ticket', JSON.stringify(ticket));
  
  // Also save to the admin-accessible tickets store
  const adminTickets = JSON.parse(localStorage.getItem('novatrade_support_tickets') || '[]');
  const ticketForAdmin = {
    ...ticket,
    messages: ticket.messages.map(m => ({
      ...m,
      timestamp: m.timestamp.toISOString()
    })),
    created_at: ticket.createdAt.toISOString(),
    updated_at: ticket.updatedAt.toISOString(),
    user_email: ticket.userEmail,
    user_name: ticket.userName,
    user_id: ticket.userId,
    priority: 'medium',
  };
  
  const existingIdx = adminTickets.findIndex((t: any) => t.id === ticket.id);
  if (existingIdx >= 0) {
    adminTickets[existingIdx] = ticketForAdmin;
  } else {
    adminTickets.push(ticketForAdmin);
  }
  localStorage.setItem('novatrade_support_tickets', JSON.stringify(adminTickets));
};

// ============================================
// SUPPORT WIDGET COMPONENT
// ============================================
export default function SupportWidget() {
  const { user, isAuthenticated } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'faq' | 'chat' | 'faq-detail'>('menu');
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [message, setMessage] = useState('');
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load existing ticket on mount
  useEffect(() => {
    const existingTicket = getSupportTicket();
    if (existingTicket) {
      setTicket(existingTicket);
      // Count unread admin messages
      const unread = existingTicket.messages.filter(m => m.sender === 'admin' && !m.read).length;
      setUnreadCount(unread);
    }
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (view === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticket?.messages, view]);

  // Mark messages as read when viewing chat
  useEffect(() => {
    if (view === 'chat' && ticket) {
      const updatedMessages = ticket.messages.map(m => ({
        ...m,
        read: true
      }));
      const updatedTicket = { ...ticket, messages: updatedMessages };
      setTicket(updatedTicket);
      saveSupportTicket(updatedTicket);
      setUnreadCount(0);
    }
  }, [view]);

  // Filter FAQs
  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Start or continue chat
  const startChat = () => {
    if (!ticket) {
      const newTicket: SupportTicket = {
        id: `TKT-${Date.now()}`,
        userId: user?.id || 'guest',
        userEmail: user?.email || 'guest@unknown.com',
        userName: user?.firstName || 'Guest',
        status: 'open',
        messages: [
          {
            id: `msg-${Date.now()}`,
            content: `Hello ${user?.firstName || 'there'}! 👋 Welcome to NovaTrade Support. How can we help you today? Our team typically responds within a few minutes during business hours.`,
            sender: 'bot',
            timestamp: new Date(),
            read: true
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setTicket(newTicket);
      saveSupportTicket(newTicket);
    }
    setView('chat');
  };

  // Send message
  const sendMessage = () => {
    if (!message.trim() || !ticket) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: message.trim(),
      sender: 'user',
      timestamp: new Date(),
      read: true
    };

    const updatedTicket = {
      ...ticket,
      messages: [...ticket.messages, newMessage],
      updatedAt: new Date()
    };

    setTicket(updatedTicket);
    saveSupportTicket(updatedTicket);
    setMessage('');

    // Simulate bot acknowledgment after a short delay
    setTimeout(() => {
      const botMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        content: "Thanks for your message! A support agent will respond shortly. In the meantime, feel free to check our FAQs for quick answers.",
        sender: 'bot',
        timestamp: new Date(),
        read: false
      };

      const ticketWithBot = {
        ...updatedTicket,
        messages: [...updatedTicket.messages, botMessage],
        updatedAt: new Date()
      };

      setTicket(ticketWithBot);
      saveSupportTicket(ticketWithBot);
    }, 1000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-50 w-14 h-14 bg-gradient-to-r from-gold to-gold/80 rounded-full shadow-lg shadow-gold/20 flex items-center justify-center hover:scale-110 transition-transform"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-void" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-void" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-loss text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </motion.button>

      {/* Widget Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 left-4 z-50 w-80 sm:w-96 bg-charcoal border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 120px)' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-gold/20 to-electric/20 p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {view !== 'menu' && (
                  <button
                    onClick={() => {
                      if (view === 'faq-detail') setView('faq');
                      else setView('menu');
                    }}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-cream" />
                  </button>
                )}
                <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-gold" />
                </div>
                <div className="flex-1">
                  <h3 className="text-cream font-semibold">NovaTrade Support</h3>
                  <p className="text-xs text-cream/60">
                    {view === 'chat' ? 'Chat with us' : view === 'faq' ? 'Frequently Asked Questions' : 'How can we help?'}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="h-80 sm:h-96 overflow-y-auto">
              {/* Menu View */}
              {view === 'menu' && (
                <div className="p-4 space-y-3">
                  <p className="text-sm text-cream/70 mb-4">
                    Hi {user?.firstName || 'there'}! 👋 What can we help you with?
                  </p>

                  {/* FAQ Button */}
                  <button
                    onClick={() => setView('faq')}
                    className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-4 transition-all group"
                  >
                    <div className="w-12 h-12 bg-electric/20 rounded-xl flex items-center justify-center">
                      <HelpCircle className="w-6 h-6 text-electric" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-cream font-medium">Browse FAQs</p>
                      <p className="text-xs text-cream/60">Find quick answers to common questions</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-cream/40 group-hover:text-cream transition-colors" />
                  </button>

                  {/* Chat Button */}
                  <button
                    onClick={startChat}
                    className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-4 transition-all group"
                  >
                    <div className="w-12 h-12 bg-profit/20 rounded-xl flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-profit" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-cream font-medium">Live Chat</p>
                      <p className="text-xs text-cream/60">Chat with our support team</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ticket && ticket.messages.length > 1 && (
                        <span className="px-2 py-0.5 bg-gold/20 text-gold text-xs rounded-full">
                          {ticket.messages.length - 1}
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-cream/40 group-hover:text-cream transition-colors" />
                    </div>
                  </button>

                  {/* Quick Links */}
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-cream/50 mb-3">Quick Links</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Deposits', 'Withdrawals', 'Trading', 'Account'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setView('faq');
                          }}
                          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-cream/70 hover:text-cream transition-all"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* FAQ View */}
              {view === 'faq' && (
                <div className="p-4 space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/40" />
                    <input
                      type="text"
                      placeholder="Search FAQs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-gold/50"
                    />
                  </div>

                  {/* Categories */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {faqCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                          selectedCategory === cat
                            ? 'bg-gold text-void font-medium'
                            : 'bg-white/5 text-cream/60 hover:bg-white/10'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* FAQ List */}
                  <div className="space-y-2">
                    {filteredFaqs.map(faq => (
                      <button
                        key={faq.id}
                        onClick={() => {
                          setSelectedFaq(faq);
                          setView('faq-detail');
                        }}
                        className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left transition-all group"
                      >
                        <div className="flex items-start gap-2">
                          <HelpCircle className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-cream group-hover:text-gold transition-colors">{faq.question}</p>
                            <p className="text-xs text-cream/40 mt-1">{faq.category}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-cream/40 group-hover:text-cream transition-colors" />
                        </div>
                      </button>
                    ))}

                    {filteredFaqs.length === 0 && (
                      <div className="text-center py-8">
                        <HelpCircle className="w-12 h-12 text-cream/20 mx-auto mb-3" />
                        <p className="text-sm text-cream/60">No FAQs found</p>
                        <button
                          onClick={startChat}
                          className="mt-3 px-4 py-2 bg-gold/10 text-gold text-sm rounded-lg hover:bg-gold/20 transition-all"
                        >
                          Ask Support
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FAQ Detail View */}
              {view === 'faq-detail' && selectedFaq && (
                <div className="p-4">
                  <div className="mb-4">
                    <span className="px-2 py-1 bg-gold/10 text-gold text-xs rounded-lg">
                      {selectedFaq.category}
                    </span>
                  </div>
                  <h4 className="text-cream font-medium mb-3">{selectedFaq.question}</h4>
                  <p className="text-sm text-cream/70 leading-relaxed">{selectedFaq.answer}</p>

                  <div className="mt-6 pt-4 border-t border-white/10">
                    <p className="text-xs text-cream/50 mb-3">Was this helpful?</p>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2 bg-profit/10 text-profit text-sm rounded-lg hover:bg-profit/20 transition-all">
                        👍 Yes
                      </button>
                      <button className="flex-1 py-2 bg-loss/10 text-loss text-sm rounded-lg hover:bg-loss/20 transition-all">
                        👎 No
                      </button>
                    </div>
                    <button
                      onClick={startChat}
                      className="w-full mt-3 py-2 bg-white/5 text-cream/70 text-sm rounded-lg hover:bg-white/10 transition-all"
                    >
                      Still need help? Chat with us
                    </button>
                  </div>
                </div>
              )}

              {/* Chat View */}
              {view === 'chat' && ticket && (
                <div className="flex flex-col h-full">
                  {/* Messages */}
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {ticket.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] ${
                            msg.sender === 'user'
                              ? 'bg-gold text-void rounded-2xl rounded-br-md'
                              : msg.sender === 'admin'
                              ? 'bg-electric/20 text-cream rounded-2xl rounded-bl-md'
                              : 'bg-white/10 text-cream rounded-2xl rounded-bl-md'
                          } px-4 py-2.5`}
                        >
                          {msg.sender !== 'user' && (
                            <div className="flex items-center gap-2 mb-1">
                              {msg.sender === 'bot' ? (
                                <Bot className="w-3 h-3 text-gold" />
                              ) : (
                                <User className="w-3 h-3 text-electric" />
                              )}
                              <span className="text-xs opacity-70">
                                {msg.sender === 'bot' ? 'Bot' : 'Support'}
                              </span>
                            </div>
                          )}
                          <p className="text-sm">{msg.content}</p>
                          <div className={`flex items-center gap-1 mt-1 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                            <Clock className="w-3 h-3 opacity-50" />
                            <span className="text-xs opacity-50">{formatTime(msg.timestamp)}</span>
                            {msg.sender === 'user' && (
                              <CheckCircle className="w-3 h-3 opacity-50 ml-1" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input (only in chat view) */}
            {view === 'chat' && (
              <div className="p-4 border-t border-white/10 bg-void/50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-gold/50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className="p-2.5 bg-gold text-void rounded-xl hover:bg-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
