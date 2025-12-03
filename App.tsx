
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Destination, Stop, Flight, Activity, PackingItem, Expense, CURRENCIES, LinkItem, TravelDetails, DayPlan, Cost, AgencyProfile, DEFAULT_AGENCY, TripStatus, AgencyTask } from './types';
import Map from './components/Map';
import { generatePackingSuggestions, generateItinerarySuggestion, suggestNextStop, askTripAssistant, suggestAgencyTasks, getPhrases } from './services/geminiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as ReTooltip } from 'recharts';
import { Plus, Trash2, MapPin, Plane, Calendar, Briefcase, Check, ArrowRight, RefreshCw, LayoutGrid, List, Wand2, Car, Link as LinkIcon, X, ChevronDown, ChevronUp, GripVertical, Info, ExternalLink, Edit2, Search, Home, Settings, DollarSign, Globe, Menu, Printer, CloudSun, Loader2, AlertCircle, Map as MapIcon, ChevronLeft, ChevronRight, Clock, Sun, Moon, Coffee, Lightbulb, ArrowUp, ArrowDown, Luggage, Download, Upload, Timer, StickyNote, Compass, Train, Users, Eye, EyeOff, Save, Building2, Phone, Mail, LogOut, MessageSquare, Send, Bot, Columns, User, MoreHorizontal, FileText, CheckCircle2, ClipboardList, Sparkles, TrendingUp, Languages, Calculator, Cloud, Volume2, Utensils, Camera, Palmtree, Mountain, Ticket, CircleDashed, CreditCard } from 'lucide-react';

// --- Utilities ---
const INITIAL_RATES = { 'EUR': 1, 'USD': 1.08, 'GBP': 0.85, 'ZAR': 20.5, 'LKR': 330, 'JPY': 160, 'AUD': 1.65 };

const convertCurrency = (amount: number, from: string, to: string, rates: Record<string, number>) => {
  if (from === to) return amount;
  const inEur = amount / (rates[from] || 1);
  return inEur * (rates[to] || 1);
};

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const getDaysArray = (start: string, end: string) => {
    const arr = [];
    const dt = new Date(start);
    const endDt = new Date(end);
    while (dt <= endDt) {
        arr.push(new Date(dt).toISOString().split('T')[0]);
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
};

// Haversine formula for distance in km
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    const d = R * c; 
    return Math.round(d);
};

const getDurationString = (startStr: string, endStr?: string) => {
    if (!startStr || !endStr) return '';
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
};

// --- Data ---
const AIRLINES = [
    { name: 'Emirates', domain: 'emirates.com' },
    { name: 'Qatar Airways', domain: 'qatarairways.com' },
    { name: 'Singapore Airlines', domain: 'singaporeair.com' },
    { name: 'Delta Air Lines', domain: 'delta.com' },
    { name: 'American Airlines', domain: 'aa.com' },
    { name: 'United Airlines', domain: 'united.com' },
    { name: 'Lufthansa', domain: 'lufthansa.com' },
    { name: 'British Airways', domain: 'britishairways.com' },
    { name: 'Air France', domain: 'airfrance.fr' },
    { name: 'KLM', domain: 'klm.com' },
    { name: 'Turkish Airlines', domain: 'turkishairlines.com' },
    { name: 'Etihad Airways', domain: 'etihad.com' },
    { name: 'Cathay Pacific', domain: 'cathaypacific.com' },
    { name: 'Ryanair', domain: 'ryanair.com' },
    { name: 'EasyJet', domain: 'easyjet.com' },
    { name: 'Southwest Airlines', domain: 'southwest.com' },
    { name: 'Japan Airlines', domain: 'jal.co.jp' },
    { name: 'ANA (All Nippon Airways)', domain: 'ana.co.jp' },
    { name: 'Qantas', domain: 'qantas.com' },
    { name: 'Virgin Atlantic', domain: 'virginatlantic.com' },
    { name: 'Air Canada', domain: 'aircanada.com' },
    { name: 'Swiss', domain: 'swiss.com' },
    { name: 'Korean Air', domain: 'koreanair.com' },
    { name: 'China Southern', domain: 'csair.com' },
    { name: 'Iberia', domain: 'iberia.com' },
    { name: 'SAS', domain: 'flysas.com' },
];

const getAirlineLogo = (domain: string) => `https://logo.clearbit.com/${domain}`;

// --- UI Components ---

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto animate-fade-in-up print:hidden">
    <div className="bg-white/80 backdrop-blur-2xl border border-white/50 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col scale-100">
      <div className="flex justify-between items-center p-5 border-b border-white/30 sticky top-0 z-10 bg-white/40">
        <h3 className="text-xl font-bold text-slate-800 drop-shadow-sm">{title}</h3>
        <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500"/></button>
      </div>
      <div className="p-6 overflow-y-auto custom-scrollbar relative">
        {children}
      </div>
    </div>
  </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost', loading?: boolean }> = ({ variant = 'primary', className = '', loading = false, children, ...props }) => {
    const base = "px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation";
    const variants = {
        primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200",
        secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm",
        danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
        ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    };
    return (
        <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
};

const InputGroup: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
    <div className="space-y-1.5">
        <div className="flex justify-between">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">{label}</label>
            {error && <span className="text-xs text-red-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</span>}
        </div>
        {children}
    </div>
);

const EmptyState: React.FC<{ icon: any, title: string, description: string, action?: React.ReactNode }> = ({ icon: Icon, title, description, action }) => (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6 border-2 border-dashed border-slate-300/50 rounded-3xl bg-slate-50/30">
        <div className="w-16 h-16 bg-white/60 rounded-full flex items-center justify-center shadow-sm mb-4 backdrop-blur-sm">
            <Icon className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-1">{title}</h3>
        <p className="text-slate-500 text-sm max-w-xs mb-6">{description}</p>
        {action}
    </div>
);

const AirportAutocomplete: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  onSelect: (data: { lat: number; lng: number; iata?: string; name: string }) => void;
}> = ({ label, value, onChange, onSelect }) => {
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (isOpen && value && value.length > 2) {
        try {
          // Use addressdetails=1 and extratags=1 to get IATA code
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              value + " airport"
            )}&limit=5&accept-language=en&extratags=1&addressdetails=1`
          );
          const data = await res.json();
          setResults(data);
        } catch (e) {
          console.error(e);
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [value, isOpen]);

  return (
    <div className="relative" ref={wrapperRef}>
      <InputGroup label={label}>
        <div className="relative group">
           <Plane className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
           <input
            className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all uppercase placeholder:normal-case font-medium"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search city or code..."
          />
        </div>
      </InputGroup>
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/50 z-50 max-h-60 overflow-y-auto animate-fade-in-up">
          {results.map((r: any, i: number) => {
             const iata = r.extratags?.iata;
             return (
            <div
              key={i}
              className="p-3 hover:bg-indigo-50/50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
              onClick={() => {
                const nameParts = r.display_name.split(",");
                const shortName = nameParts[0];
                
                onChange(shortName);
                onSelect({ 
                    lat: parseFloat(r.lat), 
                    lng: parseFloat(r.lon),
                    iata: iata,
                    name: shortName 
                });
                setIsOpen(false);
              }}
            >
              <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-slate-800">{r.display_name.split(",")[0]}</span>
                  {iata && <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{iata}</span>}
              </div>
              <div className="text-xs text-slate-500 truncate">{r.display_name}</div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
};

const AirlineAutocomplete: React.FC<{
  value: string;
  onChange: (val: string) => void;
  onSelect: (airline: { name: string; logo: string }) => void;
}> = ({ value, onChange, onSelect }) => {
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  useEffect(() => {
    if (value && isOpen) {
        const filtered = AIRLINES.filter(a => a.name.toLowerCase().includes(value.toLowerCase()));
        setResults(filtered);
    } else {
        setResults([]);
    }
  }, [value, isOpen]);

  return (
    <div className="relative" ref={wrapperRef}>
      <InputGroup label="Airline">
        <div className="relative group">
           <Plane className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
           <input
            className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search airline..."
          />
        </div>
      </InputGroup>
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/50 z-50 max-h-60 overflow-y-auto animate-fade-in-up">
          {results.map((a: any, i: number) => (
            <div
              key={i}
              className="p-3 hover:bg-indigo-50/50 cursor-pointer transition-colors border-b border-slate-50 last:border-0 flex items-center gap-4"
              onClick={() => {
                onChange(a.name);
                onSelect({ name: a.name, logo: getAirlineLogo(a.domain) });
                setIsOpen(false);
              }}
            >
              <img src={getAirlineLogo(a.domain)} alt={a.name} className="w-10 h-10 object-contain rounded-md bg-white border border-slate-100 p-0.5" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <div className="font-bold text-base text-slate-800">{a.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AiAssistant: React.FC<{ tripState: AppState }> = ({ tripState }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'model', parts: {text: string}[]}[]>([
        { role: 'model', parts: [{ text: "Hi! I'm your Trip Assistant. I have context on this itinerary. Ask me to draft emails, analyze the budget, or suggest ideas!" }]}
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', parts: [{ text: userMsg }] }]);
        setLoading(true);

        const response = await askTripAssistant(userMsg, tripState, messages);
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: response }] }]);
        setLoading(false);
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 flex items-center justify-center ${isOpen ? 'bg-red-500 rotate-90' : 'bg-indigo-600'}`}
            >
                {isOpen ? <X className="w-6 h-6 text-white"/> : <Bot className="w-8 h-8 text-white"/>}
            </button>

            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-3xl shadow-2xl z-50 border border-slate-200 flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="p-4 bg-indigo-600 text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"><Bot className="w-6 h-6"/></div>
                        <div>
                            <div className="font-bold">Trip Co-Pilot</div>
                            <div className="text-xs text-indigo-200">Context: {tripState.clientName}'s Trip</div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-700 shadow-sm border border-slate-200 rounded-bl-none'}`}>
                                    {m.parts[0].text}
                                </div>
                            </div>
                        ))}
                        {loading && <div className="flex justify-start"><div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm border border-slate-200 flex gap-1"><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div></div></div>}
                        <div ref={chatEndRef}></div>
                    </div>
                    <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
                        <input 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ask about this trip..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                        />
                        <button disabled={loading} onClick={handleSend} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"><Send className="w-5 h-5"/></button>
                    </div>
                </div>
            )}
        </>
    );
};

const StepDestinations: React.FC<{ 
  selected: Destination[]; 
  onSelect: (d: Destination) => void; 
  onRemove: (id: string) => void; 
  onNext: () => void;
}> = ({ selected, onSelect, onRemove, onNext }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);

  // Improved popular suggestions (English)
  const SUGGESTIONS = [
    { name: 'Italy', flag: '🇮🇹', lat: 41.8719, lng: 12.5674 },
    { name: 'Japan', flag: '🇯🇵', lat: 36.2048, lng: 138.2529 },
    { name: 'Spain', flag: '🇪🇸', lat: 40.4637, lng: -3.7492 },
    { name: 'United States', flag: '🇺🇸', lat: 37.0902, lng: -95.7129 },
    { name: 'Thailand', flag: '🇹🇭', lat: 15.8700, lng: 100.9925 },
    { name: 'France', flag: '🇫🇷', lat: 46.2276, lng: 2.2137 }, 
    { name: 'Australia', flag: '🇦🇺', lat: -25.2744, lng: 133.7751 }, 
    { name: 'Brazil', flag: '🇧🇷', lat: -14.2350, lng: -51.9253 }, 
    { name: 'Canada', flag: '🇨🇦', lat: 56.1304, lng: -106.3468 },
    { name: 'Vietnam', flag: '🇻🇳', lat: 14.0583, lng: 108.2772 },
  ];

  // Robust Normalization
  const normalizeCountryName = (name: string) => {
      const n = name.toLowerCase().trim();
      if (n === 'united states of america' || n === 'usa' || n === 'us') return 'united states';
      if (n === 'great britain' || n === 'united kingdom' || n === 'uk') return 'uk';
      if (n.startsWith('the ')) return n.replace('the ', '');
      return n;
  };

  const isAlreadySelected = (name: string) => {
    const target = normalizeCountryName(name);
    return selected.some(d => normalizeCountryName(d.name) === target);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
        if (query.length >= 2) {
            performSearch(query);
        } else {
            setResults([]);
        }
    }, 300); 

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&featuretype=country&addressdetails=1&limit=5&accept-language=en`);
      const data = await res.json();
      const countryResults = data.filter((item: any) => item.addresstype === 'country');
      setResults(countryResults);
    } catch { /* ignore */ } finally { setSearching(false); }
  };

  const addDestination = (name: string, lat: number, lng: number) => {
      if (isAlreadySelected(name)) {
          setQuery(''); setResults([]); return;
      }
      onSelect({ id: crypto.randomUUID(), name, lat, lng });
      setQuery(''); setResults([]);
  };

  const selectResult = (item: any) => {
    const name = item.address?.country || item.display_name.split(',')[0]; 
    addDestination(name, parseFloat(item.lat), parseFloat(item.lon));
  };

  const handleCountryClick = (country: { name: string; lat: number; lng: number }) => {
      if (isAlreadySelected(country.name)) {
          const target = normalizeCountryName(country.name);
          const existing = selected.find(d => normalizeCountryName(d.name) === target);
          if (existing) onRemove(existing.id);
      } else { 
          addDestination(country.name, country.lat, country.lng); 
      }
  };

  const visibleResults = results.filter(r => {
      const name = r.address?.country || r.display_name.split(',')[0];
      return !isAlreadySelected(name);
  });

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900">
      <div className="absolute inset-0 z-0 h-[60vh] md:h-full opacity-100">
          <Map destinations={selected} interactive={true} showCountries={true} onCountrySelect={handleCountryClick} />
      </div>
      
      <div className={`absolute bottom-0 left-0 right-0 md:top-6 md:left-6 md:bottom-6 md:w-[480px] z-10 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${isPanelExpanded ? 'h-[85vh] md:h-[calc(100vh-3rem)]' : 'h-24 md:h-[calc(100vh-3rem)]'}`}>
          <div className="w-full h-full flex flex-col bg-white/20 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] rounded-t-3xl md:rounded-3xl overflow-hidden border border-white/20 relative">
              
              <div className="md:hidden w-full flex justify-center pt-3 pb-1 cursor-pointer" onClick={() => setIsPanelExpanded(!isPanelExpanded)}>
                  <div className="w-12 h-1.5 bg-white/40 rounded-full backdrop-blur-sm shadow-sm"></div>
              </div>
              
              <div className="px-8 pt-8 pb-4 relative z-20">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/30 text-indigo-900 rounded-full text-xs font-bold mb-4 border border-white/30 backdrop-blur-md shadow-sm">
                      Step 1 of 3
                  </div>
                  <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-tight drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                    Where to next?
                  </h1>
                  <p className="text-slate-700 mt-2 font-medium text-lg drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">Build your world trip by selecting countries.</p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-2 space-y-6 relative z-20">
                  <div className="relative z-30 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-700 transition-colors" /></div>
                    <input 
                        type="text" 
                        value={query} 
                        onFocus={() => setIsPanelExpanded(true)} 
                        onChange={(e) => setQuery(e.target.value)} 
                        placeholder="Type to search countries..." 
                        className="block w-full pl-12 pr-4 py-4 border border-white/40 rounded-2xl leading-5 bg-white/40 backdrop-blur-xl placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/60 focus:border-white/60 transition-all shadow-lg shadow-indigo-900/5 text-slate-900 font-bold text-lg"
                    />
                    {searching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 animate-spin text-indigo-700"/></div>}
                    
                    {visibleResults.length > 0 && (
                        <ul className="absolute top-full left-0 right-0 mt-2 bg-white/70 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-xl z-50 max-h-60 overflow-auto divide-y divide-white/30 animate-fade-in-up ring-1 ring-black/5">
                            {visibleResults.map((r, i) => (
                                <li key={i} onClick={() => selectResult(r)} className="p-4 hover:bg-white/60 cursor-pointer flex items-center gap-3 text-slate-800 transition-colors group">
                                    <div className="bg-white/60 p-2 rounded-xl group-hover:bg-white/80 group-hover:text-indigo-600 transition-colors shadow-sm"><Globe className="w-4 h-4 text-slate-600"/></div>
                                    <span className="font-bold text-base">{r.display_name}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                  </div>

                  {selected.length > 0 && (
                      <div className="space-y-3 animate-fade-in-up">
                          <div className="flex items-center justify-between"><label className="text-xs font-bold text-slate-600 uppercase tracking-wider drop-shadow-sm">Your Itinerary</label><span className="text-xs font-bold bg-white/40 text-indigo-800 px-2.5 py-1 rounded-full border border-white/30 shadow-sm">{selected.length} Countries</span></div>
                          <div className="space-y-2">
                              {selected.map((dest, i) => (
                                  <div key={dest.id} className="relative group animate-fade-in-up" style={{animationDelay: `${i * 50}ms`}}>
                                      <div className="flex items-center bg-white/40 backdrop-blur-md p-3 rounded-2xl border border-white/40 shadow-sm group-hover:shadow-md group-hover:bg-white/60 transition-all">
                                          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/30 flex-shrink-0 backdrop-blur-sm bg-opacity-90">
                                              {i + 1}
                                          </div>
                                          <div className="ml-3 flex-1">
                                              <div className="font-bold text-slate-900">{dest.name}</div>
                                          </div>
                                          <button onClick={() => onRemove(dest.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-500/20 rounded-xl transition-colors">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                      {i < selected.length - 1 && (
                                          <div className="absolute left-[19px] -bottom-3 w-0.5 h-4 bg-white/50 -z-10 group-hover:bg-indigo-400/50 transition-colors"></div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {!query && (
                      <div className="space-y-4 pt-2">
                          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider drop-shadow-sm">Popular Destinations</label>
                          <div className="grid grid-cols-2 gap-3">
                              {SUGGESTIONS.map(s => {
                                  const isSelected = isAlreadySelected(s.name);
                                  return (
                                  <button 
                                    key={s.name} 
                                    disabled={isSelected}
                                    onClick={() => addDestination(s.name, s.lat, s.lng)} 
                                    className={`flex items-center gap-3 px-3 py-3 backdrop-blur-md border rounded-2xl transition-all text-left ${isSelected ? 'bg-indigo-600/10 border-indigo-200 cursor-default' : 'bg-white/30 border-white/30 hover:bg-white/60 hover:border-white/60 hover:shadow-lg active:scale-95'}`}
                                  >
                                      <span className="text-2xl shadow-sm rounded-lg w-8 h-8 flex items-center justify-center bg-white/60">{s.flag}</span>
                                      <div className="flex-1 min-w-0">
                                          <span className={`text-sm font-bold line-clamp-1 ${isSelected ? 'text-indigo-800' : 'text-slate-800'}`}>{s.name}</span>
                                      </div>
                                      {isSelected && <div className="bg-indigo-600 text-white rounded-full p-1"><Check className="w-3 h-3"/></div>}
                                  </button>
                              )})}
                          </div>
                      </div>
                  )}
              </div>

              <div className="p-6 border-t border-white/20 bg-white/10 backdrop-blur-md shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
                  <Button onClick={onNext} disabled={selected.length === 0} className="w-full py-4 text-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/40 hover:-translate-y-1 border border-indigo-500/50 backdrop-blur-sm">
                      Start Planning <ArrowRight className="w-5 h-5"/>
                  </Button>
              </div>
          </div>
      </div>
    </div>
  );
};

// --- Step 2: Route & Logistics ---

const StepRoute: React.FC<{
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onNext: () => void;
  onBack: () => void;
}> = ({ state, setState, onNext, onBack }) => {
  const [modal, setModal] = useState<'stop' | 'flight' | 'travel' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [travelStopIndex, setTravelStopIndex] = useState<number | null>(null);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const openStopModal = (stop?: Stop, insertIndex?: number, prefillCoords?: {lat: number, lng: number}) => {
    setEditingId(stop?.id || null);
    setInsertAtIndex(insertIndex ?? null);
    let defaultStart = '';
    if (!stop) {
        const prevStopIndex = insertIndex !== undefined ? insertIndex - 1 : state.stops.length - 1;
        if (prevStopIndex >= 0 && state.stops[prevStopIndex]) defaultStart = state.stops[prevStopIndex].end;
    }
    
    let initialPlace = stop?.place || '';
    if (prefillCoords && !initialPlace) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${prefillCoords.lat}&lon=${prefillCoords.lng}&zoom=10&accept-language=en`)
            .then(r => r.json())
            .then(d => {
                const city = d.address?.city || d.address?.town || d.address?.village || d.address?.county || '';
                setFormData(prev => ({...prev, place: city, lat: prefillCoords.lat, lng: prefillCoords.lng}));
            });
    }

    setFormData(stop || { place: initialPlace, start: defaultStart, end: '', hotelCost: { amount: 0, currency: state.homeCurrency }, dailyBudget: { amount: 0, currency: state.homeCurrency }, notes: '', accommodation: '', boardType: 'None', lat: prefillCoords?.lat, lng: prefillCoords?.lng });
    setModal('stop');
  };

  const openFlightModal = (flight?: Flight) => {
    setEditingId(flight?.id || null);
    setFormData(flight || { airline: '', logo: '', flightNumber: '', from: '', to: '', fromIata: '', toIata: '', departure: '', arrival: '', cost: { amount: 0, currency: state.homeCurrency } });
    setModal('flight');
  };

  const openTravelModal = (stopIndex: number) => {
    setTravelStopIndex(stopIndex);
    const existing = state.stops[stopIndex].travelToThisStop;
    setFormData(existing || { type: 'Car', company: '', details: '', cost: { amount: 0, currency: state.homeCurrency } });
    setModal('travel');
  };

  const handleMapClick = (coords: { lat: number, lng: number }) => {
      openStopModal(undefined, undefined, coords);
  };

  const handleSuggestNextStop = async () => {
      setIsSuggesting(true);
      try {
          const suggestion = await suggestNextStop(state.stops);
          if (suggestion) {
              const lastStop = state.stops[state.stops.length - 1];
              const newStop: Stop = {
                  id: crypto.randomUUID(),
                  seq: state.stops.length + 1,
                  place: suggestion.name,
                  start: lastStop?.end || '', 
                  end: '',
                  lat: suggestion.lat,
                  lng: suggestion.lng,
                  hotelCost: { amount: 0, currency: state.homeCurrency },
                  dailyBudget: { amount: 0, currency: state.homeCurrency },
                  notes: `AI Reason: ${suggestion.reason}`,
                  accommodation: '',
                  boardType: 'None'
              };
              setState(s => ({ ...s, stops: [...s.stops, newStop] }));
          } else {
              alert("Could not find a suggestion. Try adding more context to your route.");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsSuggesting(false);
      }
  };

  const saveStop = async () => {
    if (!formData.place) return;
    setIsSaving(true);
    let lat = formData.lat || 0; let lng = formData.lng || 0;
    
    if (!lat || !lng) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.place)}&limit=1&accept-language=en`);
            const data = await res.json();
            if(data[0]) { lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon); }
        } catch(e) { }
    }
    const newStop: Stop = { id: editingId || crypto.randomUUID(), seq: 0, place: formData.place, start: formData.start, end: formData.end, lat, lng, hotelCost: formData.hotelCost, dailyBudget: formData.dailyBudget, travelToThisStop: formData.travelToThisStop, notes: formData.notes, accommodation: formData.accommodation, boardType: formData.boardType };
    let newStops = [...state.stops];
    if (editingId) { newStops = newStops.map(st => st.id === editingId ? newStop : st); } 
    else if (insertAtIndex !== null) { newStops.splice(insertAtIndex, 0, newStop); } 
    else { newStops.push(newStop); }
    newStops.forEach((s, i) => s.seq = i + 1);
    setState(s => ({ ...s, stops: newStops }));
    setIsSaving(false); setModal(null);
  };

  const moveStop = (index: number, direction: 'up' | 'down') => {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === state.stops.length - 1)) return;
      const newStops = [...state.stops];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newStops[index], newStops[targetIndex]] = [newStops[targetIndex], newStops[index]];
      newStops.forEach((s, i) => s.seq = i + 1);
      setState(s => ({...s, stops: newStops}));
  };

  const saveFlight = async () => {
      setIsSaving(true);
      let fromLat = formData.fromLat;
      let fromLng = formData.fromLng;
      let toLat = formData.toLat;
      let toLng = formData.toLng;
      
      if (!fromLat && formData.from) { try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.from + ' airport')}&limit=1&accept-language=en`); const data = await res.json(); if(data[0]) { fromLat = parseFloat(data[0].lat); fromLng = parseFloat(data[0].lon); } } catch(e) {} }
      if (!toLat && formData.to) { try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.to + ' airport')}&limit=1&accept-language=en`); const data = await res.json(); if(data[0]) { toLat = parseFloat(data[0].lat); toLng = parseFloat(data[0].lon); } } catch(e) {} }

      const newFlight: Flight = { 
          id: editingId || crypto.randomUUID(), 
          ...formData, 
          fromIata: formData.fromIata?.toUpperCase(),
          toIata: formData.toIata?.toUpperCase(),
          fromLat, fromLng, toLat, toLng 
      };

      if (editingId) {
          setState(s => ({ ...s, flights: s.flights.map(f => f.id === editingId ? newFlight : f) }));
      } else {
          setState(s => ({ ...s, flights: [...s.flights, newFlight] }));
      }
      setIsSaving(false); setModal(null);
  };

  const saveTravel = () => {
      if (travelStopIndex === null) return;
      const updatedStops = [...state.stops];
      updatedStops[travelStopIndex] = { ...updatedStops[travelStopIndex], travelToThisStop: formData };
      setState(s => ({ ...s, stops: updatedStops }));
      setModal(null);
  };

  const dateError = formData.start && formData.end && formData.end < formData.start ? "End date cannot be before start date" : undefined;
  const isStopFormValid = formData.place && formData.start && formData.end && !dateError;

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-900">
        <div className="absolute inset-0 z-0 opacity-100">
             <Map destinations={state.destinations} stops={state.stops} flights={state.flights} onMapClick={handleMapClick} />
        </div>

        <div className={`absolute bottom-0 left-0 right-0 md:top-6 md:left-6 md:bottom-6 md:w-[480px] z-10 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${isPanelExpanded ? 'h-[85vh] md:h-[calc(100vh-3rem)]' : 'h-24 md:h-[calc(100vh-3rem)]'}`}>
            <div className="w-full h-full flex flex-col bg-white/20 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] rounded-t-3xl md:rounded-3xl overflow-hidden border border-white/20 relative">
                
                <div className="md:hidden w-full flex justify-center pt-3 pb-1 cursor-pointer" onClick={() => setIsPanelExpanded(!isPanelExpanded)}>
                     <div className="w-12 h-1.5 bg-white/40 rounded-full backdrop-blur-sm shadow-sm"></div>
                </div>

                <div className="px-8 pt-8 pb-4 relative z-20">
                     <div className="flex items-center justify-between mb-2">
                        <button onClick={onBack} className="text-slate-700 hover:text-indigo-800 transition-colors flex items-center gap-1 text-sm font-bold backdrop-blur-md px-2 py-1 rounded-lg hover:bg-white/40"><ArrowRight className="w-4 h-4 rotate-180"/> Back</button>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/30 text-indigo-900 rounded-full text-xs font-bold border border-white/30 backdrop-blur-md shadow-sm">
                            Step 2 of 3
                        </div>
                     </div>
                     <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">Route & Planning</h1>
                     <p className="text-slate-700 mt-1 font-medium drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">Build your perfect itinerary.</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-2 pb-24 lg:pb-6 relative z-20 space-y-6">
                    <div className="animate-fade-in-up">
                        <div className="flex justify-between items-center mb-3 px-2">
                             <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2 drop-shadow-sm"><Plane className="w-3 h-3"/> Flights</h3>
                             <button onClick={() => openFlightModal()} className="text-indigo-800 text-xs font-bold bg-white/30 hover:bg-white/60 border border-white/30 px-3 py-1.5 rounded-lg transition-colors backdrop-blur-sm shadow-sm">+ Add</button>
                        </div>
                        <div className="space-y-3">
                            {state.flights.map(f => {
                                const duration = getDurationString(f.departure, f.arrival);
                                return (
                                <div key={f.id} onClick={() => openFlightModal(f)} className="group relative overflow-hidden bg-white/50 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer">
                                    <div className="p-5 flex gap-4">
                                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-800 text-lg truncate">{f.airline}</span>
                                                    {f.flightNumber && <span className="text-[10px] font-mono text-slate-500 bg-slate-100/50 px-1.5 rounded border border-slate-200/50">{f.flightNumber}</span>}
                                                </div>
                                                
                                                <div className="flex items-center gap-3 my-2">
                                                    <div className="text-2xl font-black text-slate-700 tracking-tight">{f.fromIata || f.from.substring(0,3).toUpperCase()}</div>
                                                    <div className="flex-1 h-px bg-slate-300 relative flex items-center justify-center">
                                                        <Plane className="w-3 h-3 text-indigo-400 absolute bg-white/50 rounded-full" />
                                                    </div>
                                                    <div className="text-2xl font-black text-slate-700 tracking-tight">{f.toIata || f.to.substring(0,3).toUpperCase()}</div>
                                                </div>

                                                <div className="text-xs text-slate-500 font-medium flex flex-wrap gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3"/>
                                                        {f.departure ? new Date(f.departure).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'Date TBD'}
                                                    </div>
                                                    {f.arrival && (
                                                        <>
                                                            <span className="text-slate-300">|</span>
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3"/>
                                                                Arr: {new Date(f.arrival).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (Local)
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-3 text-indigo-700 font-black text-lg">
                                                {formatCurrency(f.cost.amount, f.cost.currency)}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <div className="w-20 h-20 bg-white rounded-xl shadow-sm border border-white/50 p-2 flex items-center justify-center">
                                                {f.logo ? (
                                                    <img src={f.logo} alt={f.airline} className="w-full h-full object-contain mix-blend-multiply" />
                                                ) : (
                                                    <Plane className="w-8 h-8 text-slate-200" />
                                                )}
                                            </div>
                                            <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setState(s => ({...s, flights: s.flights.filter(x => x.id !== f.id)}))}}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )})}
                            {state.flights.length === 0 && (
                                <div className="ml-8 p-6 border-2 border-dashed border-white/40 bg-white/10 backdrop-blur-sm rounded-2xl text-center">
                                    <Plane className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50"/>
                                    <p className="text-slate-600 text-sm font-medium">Add flights to track costs and timing.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="animate-fade-in-up" style={{animationDelay: '100ms'}}>
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2 drop-shadow-sm"><MapPin className="w-3 h-3"/> Route Stops</h3>
                            <button onClick={() => openStopModal()} className="text-indigo-800 text-xs font-bold bg-white/30 hover:bg-white/60 border border-white/30 px-3 py-1.5 rounded-lg transition-colors backdrop-blur-sm shadow-sm">+ Add Stop</button>
                        </div>
                        <div className="relative space-y-0 pl-14 py-2">
                            <div className="absolute top-0 bottom-0 left-[27px] w-0.5 bg-slate-200 -z-10"></div>
                            
                            {state.stops.map((stop, i) => {
                                let travelDist = 0;
                                let travelTime = '';
                                if (i > 0) {
                                    const prev = state.stops[i-1];
                                    if (prev.lat && prev.lng && stop.lat && stop.lng) {
                                        travelDist = calculateDistance(prev.lat, prev.lng, stop.lat, stop.lng);
                                        const hours = Math.round(travelDist / 80);
                                        travelTime = hours > 0 ? `~${hours}h drive` : '<1h drive';
                                        
                                        if (stop.travelToThisStop?.type === 'Plane') {
                                             const flyHours = Math.round(travelDist / 800) + 1; 
                                             travelTime = `~${flyHours}h flight`;
                                        }
                                    }
                                }

                                return (
                                <div key={stop.id} className="relative group">
                                    {i > 0 && (
                                        <div className="ml-[11px] py-6 flex items-center relative z-10">
                                             <button 
                                                onClick={() => openTravelModal(i)} 
                                                className={`flex items-center gap-3 pl-1 pr-4 py-1.5 rounded-full border shadow-sm transition-all hover:scale-105 active:scale-95 group/btn ${stop.travelToThisStop ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}
                                             >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${stop.travelToThisStop ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover/btn:bg-indigo-100 group-hover/btn:text-indigo-600'}`}>
                                                    {stop.travelToThisStop?.type === 'Plane' ? <Plane className="w-4 h-4"/> : stop.travelToThisStop?.type === 'Train' ? <Train className="w-4 h-4"/> : <Car className="w-4 h-4"/>}
                                                </div>
                                                <div className="flex flex-col items-start">
                                                    <span className="text-xs font-bold uppercase tracking-wider">{stop.travelToThisStop ? stop.travelToThisStop.type : 'Add Transport'}</span>
                                                    {stop.travelToThisStop && <span className="text-[10px] opacity-80 font-medium">{formatCurrency(stop.travelToThisStop.cost.amount, stop.travelToThisStop.cost.currency)}</span>}
                                                </div>
                                             </button>
                                             
                                             <div className="text-[10px] font-bold text-slate-400 bg-white/50 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/40 ml-2">
                                                 {travelDist} km • {travelTime}
                                             </div>
                                        </div>
                                    )}

                                    {i > 0 && <button onClick={() => openStopModal(undefined, i)} className="absolute top-[-14px] left-[21px] w-3 h-3 bg-white border-2 border-slate-300 rounded-full hover:border-indigo-500 hover:bg-indigo-500 transition-colors z-20" title="Insert Stop"></button>}
                                    
                                    <div onClick={() => openStopModal(stop)} className="relative flex items-start gap-4 cursor-pointer pb-8">
                                        <div className="absolute -left-14 flex items-center justify-center w-8 pt-4">
                                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-indigo-500/30 ring-4 ring-white/30 backdrop-blur-sm z-10">
                                                {i + 1}
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 bg-white/50 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-sm hover:shadow-lg hover:bg-white/70 transition-all duration-300 group-hover:-translate-y-0.5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-bold text-slate-900 text-lg">{stop.place}</div>
                                                    <div className="text-xs text-slate-600 mt-1 font-medium bg-white/40 inline-block px-1.5 py-0.5 rounded border border-white/30">{stop.start} — {stop.end}</div>
                                                    {stop.accommodation && <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50/50 rounded-lg text-xs text-indigo-900 border border-indigo-100/50 font-bold"><Home className="w-3 h-3 text-indigo-500"/> {stop.accommodation}</div>}
                                                    {stop.notes && stop.notes.startsWith('AI Reason:') && <div className="mt-2 text-[10px] text-slate-500 bg-amber-50/80 px-2 py-1 rounded border border-amber-100 flex items-start gap-1"><Wand2 className="w-3 h-3 text-amber-500 flex-shrink-0"/> {stop.notes.replace('AI Reason:', '')}</div>}
                                                </div>
                                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="text-slate-400 hover:text-red-600 p-1 transition-colors" onClick={(e) => { e.stopPropagation(); setState(s => ({...s, stops: s.stops.filter(x => x.id !== stop.id).map((st, idx) => ({...st, seq: idx+1})) }))}}><Trash2 className="w-4 h-4"/></button>
                                                    <div className="flex flex-col">
                                                        {i > 0 && <button className="text-slate-400 hover:text-indigo-600 p-1" onClick={(e) => {e.stopPropagation(); moveStop(i, 'up')}}><ArrowUp className="w-3 h-3"/></button>}
                                                        {i < state.stops.length - 1 && <button className="text-slate-400 hover:text-indigo-600 p-1" onClick={(e) => {e.stopPropagation(); moveStop(i, 'down')}}><ArrowDown className="w-3 h-3"/></button>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )})}
                            
                            {state.stops.length === 0 ? (
                                <div className="ml-[-1rem] mr-4 p-6 border-2 border-dashed border-white/40 bg-white/10 backdrop-blur-sm rounded-2xl text-center">
                                    <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2"/>
                                    <p className="text-slate-600 text-sm font-medium">Start your route by adding a stop, or click on the map.</p>
                                </div>
                            ) : (
                                <div className="pt-2">
                                    <Button 
                                        variant="secondary" 
                                        onClick={handleSuggestNextStop} 
                                        loading={isSuggesting}
                                        className="w-full text-sm py-2 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border-indigo-100 hover:border-indigo-300 shadow-sm"
                                    >
                                        <Wand2 className="w-4 h-4 text-indigo-500"/> Suggest Next Stop
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-white/20 bg-white/10 backdrop-blur-md shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
                     <Button onClick={onNext} className="w-full py-4 text-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/40 hover:-translate-y-1 border border-indigo-500/50 backdrop-blur-sm">
                          Go to Dashboard <ArrowRight className="w-5 h-5"/>
                     </Button>
                </div>

            </div>
        </div>
        
        {modal && (
            <Modal title={modal === 'stop' ? (editingId ? "Edit Stop" : "New Stop") : modal === 'flight' ? "Add Flight" : "Transport"} onClose={() => setModal(null)}>
                {modal === 'stop' && <div className="space-y-5"><InputGroup label="Location"><input className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} autoFocus/></InputGroup><div className="grid grid-cols-2 gap-4"><InputGroup label="Arrival"><input type="date" className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.start} onChange={e => setFormData({...formData, start: e.target.value})} /></InputGroup><InputGroup label="Departure" error={dateError}><input type="date" className={`w-full p-3 border rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 outline-none transition-colors font-medium ${dateError ? 'border-red-300' : 'border-slate-200 focus:ring-indigo-500'}`} value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} /></InputGroup></div><div className="bg-slate-50/50 backdrop-blur-sm p-4 rounded-2xl space-y-4 border border-slate-100"><InputGroup label="Accommodation"><input className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.accommodation} onChange={e => setFormData({...formData, accommodation: e.target.value})} placeholder="Hotel..."/></InputGroup><div className="grid grid-cols-2 gap-4"><InputGroup label="Cost"><div className="flex"><input type="number" className="w-full p-3 border border-slate-200 rounded-l-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.hotelCost?.amount} onChange={e => setFormData({...formData, hotelCost: {...formData.hotelCost, amount: parseFloat(e.target.value)}})} /><select className="bg-white/70 backdrop-blur-sm border border-l-0 border-slate-200 p-2 rounded-r-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.hotelCost?.currency} onChange={e => setFormData({...formData, hotelCost: {...formData.hotelCost, currency: e.target.value}})}>{Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}</select></div></InputGroup><InputGroup label="Type"><select className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.boardType} onChange={e => setFormData({...formData, boardType: e.target.value})}><option value="None">Room Only</option><option value="Breakfast">Breakfast</option></select></InputGroup></div></div><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveStop} disabled={!isStopFormValid} loading={isSaving}>Save</Button></div></div>}
                {modal === 'flight' && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <AirlineAutocomplete 
                                value={formData.airline} 
                                onChange={(val) => setFormData(prev => ({...prev, airline: val}))}
                                onSelect={(a) => setFormData(prev => ({...prev, airline: a.name, logo: a.logo}))}
                            />
                            <InputGroup label="Flight Nr"><input className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.flightNumber} onChange={e => setFormData({...formData, flightNumber: e.target.value})}/></InputGroup>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <AirportAutocomplete 
                                        label="From" 
                                        value={formData.from} 
                                        onChange={(val) => setFormData(prev => ({...prev, from: val}))}
                                        onSelect={(data) => setFormData(prev => ({
                                            ...prev, 
                                            from: data.name,
                                            fromLat: data.lat, 
                                            fromLng: data.lng,
                                            fromIata: data.iata ? data.iata.toUpperCase() : prev.fromIata
                                        }))}
                                    />
                                </div>
                                <div className="w-20">
                                     <InputGroup label="IATA">
                                         <input className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-center font-black text-slate-700 uppercase" 
                                                maxLength={3} 
                                                placeholder="LHR"
                                                value={formData.fromIata || ''} 
                                                onChange={e => setFormData({...formData, fromIata: e.target.value.toUpperCase()})} />
                                     </InputGroup>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <AirportAutocomplete 
                                        label="To" 
                                        value={formData.to} 
                                        onChange={(val) => setFormData(prev => ({...prev, to: val}))}
                                        onSelect={(data) => setFormData(prev => ({
                                            ...prev, 
                                            to: data.name,
                                            toLat: data.lat, 
                                            toLng: data.lng,
                                            toIata: data.iata ? data.iata.toUpperCase() : prev.toIata
                                        }))}
                                    />
                                </div>
                                <div className="w-20">
                                     <InputGroup label="IATA">
                                         <input className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-center font-black text-slate-700 uppercase" 
                                                maxLength={3} 
                                                placeholder="JFK"
                                                value={formData.toIata || ''} 
                                                onChange={e => setFormData({...formData, toIata: e.target.value.toUpperCase()})} />
                                     </InputGroup>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Departure"><input type="datetime-local" className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.departure} onChange={e => setFormData({...formData, departure: e.target.value})}/></InputGroup>
                            <InputGroup label="Arrival (Local Time)"><input type="datetime-local" className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.arrival} onChange={e => setFormData({...formData, arrival: e.target.value})}/></InputGroup>
                        </div>
                        <InputGroup label="Cost">
                            <div className="flex">
                                <input type="number" className="w-full p-3 border rounded-l-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.cost?.amount} onChange={e => setFormData({...formData, cost: {...formData.cost, amount: parseFloat(e.target.value)}})} />
                                <select className="bg-white/70 backdrop-blur-sm border border-l-0 border-slate-200 p-2 rounded-r-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.cost?.currency} onChange={e => setFormData({...formData, cost: {...formData.cost, currency: e.target.value}})}>{Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}</select>
                            </div>
                        </InputGroup>
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveFlight} loading={isSaving}>Save</Button>
                        </div>
                    </div>
                )}
                {modal === 'travel' && <div className="space-y-5"><InputGroup label="Type"><select className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>{['Car','Train','Plane'].map(t => <option key={t}>{t}</option>)}</select></InputGroup><InputGroup label="Details"><input className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})}/></InputGroup><InputGroup label="Cost"><div className="flex"><input type="number" className="w-full p-3 border border-slate-200 rounded-l-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.cost?.amount} onChange={e => setFormData({...formData, cost: {...formData.cost, amount: parseFloat(e.target.value)}})} /><select className="bg-white/70 backdrop-blur-sm border border-l-0 border-slate-200 p-2 rounded-r-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.cost?.currency} onChange={e => setFormData({...formData, cost: {...formData.cost, currency: e.target.value}})}>{Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}</select></div></InputGroup><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveTravel}>Save</Button></div></div>}
            </Modal>
        )}
    </div>
  );
};

// --- Step 3: Dashboard ---

const StepDashboard: React.FC<{ 
    state: AppState; 
    setState: React.Dispatch<React.SetStateAction<AppState>>; 
    onBack: () => void;
    onPreviousStep: () => void;
    agencyProfile: AgencyProfile;
    isClientMode: boolean;
    toggleClientMode: () => void;
    hideCosts: boolean;
    setHideCosts: (val: boolean) => void;
}> = ({ state, setState, onBack, onPreviousStep, agencyProfile, isClientMode, toggleClientMode, hideCosts, setHideCosts }) => {
  const [activeTab, setActiveTab] = useState<'route' | 'budget' | 'flights' | 'packing' | 'links' | 'daybyday' | 'tools'>('route');
  const [rates, setRates] = useState(INITIAL_RATES);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiPrefs, setAiPrefs] = useState({ company: '', interests: [] as string[], pace: '' });
  const [detailEditId, setDetailEditId] = useState<string | null>(null);
  const [detailFormData, setDetailFormData] = useState<any>({});
  const [newExpenseModal, setNewExpenseModal] = useState(false);
  const [newFlightModal, setNewFlightModal] = useState(false);
  const [flightFormData, setFlightFormData] = useState<any>({});
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityFormData, setActivityFormData] = useState<any>({});
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
      fetch('https://api.frankfurter.app/latest?from=EUR').then(r => r.json()).then(d => setRates({...d.rates, EUR: 1})).catch(() => console.log("Using fallback rates"));
  }, []);
  
  useEffect(() => {
      const fetchWeather = async () => {
          let lat, lng;
          if (activeDayKey && state.dayPlans[activeDayKey]) {
              const stop = state.stops.find(s => s.id === state.dayPlans[activeDayKey].stopId);
              if (stop) { lat = stop.lat; lng = stop.lng; }
          } else if (state.stops.length > 0) {
              lat = state.stops[0].lat; lng = state.stops[0].lng;
          }

          if (lat && lng) {
              try {
                  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,weather_code&timezone=auto`);
                  const data = await res.json();
                  if (data.daily) setWeather(data.daily);
              } catch (e) { console.error("Weather fetch failed", e); }
          }
      };
      
      fetchWeather();
  }, [activeDayKey, state.stops]);

  useEffect(() => {
      const newDayPlans = { ...state.dayPlans };
      let changed = false;
      state.stops.forEach(stop => {
          if(stop.start && stop.end) {
              const days = getDaysArray(stop.start, stop.end);
              days.forEach(d => {
                  if(!newDayPlans[d]) {
                      newDayPlans[d] = { date: d, stopId: stop.id, status: 'default', activities: [] };
                      changed = true;
                  }
              });
          }
      });
      if(changed) setState(s => ({...s, dayPlans: newDayPlans}));
  }, [state.stops]);

  const getConvertedCost = (cost?: Cost) => cost ? convertCurrency(cost.amount, cost.currency, state.homeCurrency, rates) : 0;

  const calculateTotalCost = () => {
      let total = 0;
      state.flights.forEach(f => total += getConvertedCost(f.cost));
      state.stops.forEach(s => { total += getConvertedCost(s.hotelCost); total += getConvertedCost(s.travelToThisStop?.cost); });
      Object.values(state.dayPlans).forEach((p: any) => { p.activities.forEach((a: any) => total += getConvertedCost(a.cost)); });
      return total;
  };
  
  const grandTotal = calculateTotalCost();
  const budgetProgress = state.totalBudget > 0 ? (grandTotal / state.totalBudget) * 100 : 0;

  const togglePaid = (id: string) => {
      setState(s => {
          const currentPaid = s.paidItemIds || [];
          if(currentPaid.includes(id)) return {...s, paidItemIds: currentPaid.filter(i => i !== id)};
          return {...s, paidItemIds: [...currentPaid, id]};
      });
  };

  const scrollToStop = (id: string) => {
      if (itemRefs.current[id]) {
          setActiveTab('route');
          setTimeout(() => {
              itemRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              itemRefs.current[id]?.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
              setTimeout(() => itemRefs.current[id]?.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2'), 2000);
          }, 100);
      }
  };

  const handleExport = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `travel_${state.clientName || 'backup'}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const DashboardHeader = ({ title, icon: Icon, subtitle, rightElement }: any) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-shrink-0 print:hidden">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 hidden md:flex">
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-2xl font-extrabold text-slate-800">{title}</h2>
                <p className="text-sm text-slate-500 font-medium">{subtitle}</p>
            </div>
        </div>
        {rightElement}
    </div>
  );

  const RouteView = () => {
      const duration = useMemo(() => {
          if (state.stops.length === 0) return 0;
          const validStops = state.stops.filter(s => s.start && s.end);
          if (validStops.length === 0) return 0;
          const starts = validStops.map(s => new Date(s.start).getTime());
          const ends = validStops.map(s => new Date(s.end).getTime());
          return Math.ceil(Math.abs(Math.max(...ends) - Math.min(...starts)) / (1000 * 60 * 60 * 24)) + 1; 
      }, [state.stops]);

      const packingProgress = useMemo(() => {
          if (state.packingList.length === 0) return 0;
          return Math.round((state.packingList.filter(i => i.packed).length / state.packingList.length) * 100);
      }, [state.packingList]);

      const timelineItems = useMemo(() => {
          const items = [
              ...state.stops.map(s => ({ ...s, type: 'stop', date: s.start })),
              ...state.flights.map(f => ({ ...f, type: 'flight', date: f.departure }))
          ];
          return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }, [state.stops, state.flights]);

      const daysUntil = useMemo(() => {
          if (state.stops.length === 0) return null;
          const start = new Date(state.stops[0].start);
          const now = new Date();
          const diff = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diff;
      }, [state.stops]);

      return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 h-full animate-fade-in-up">
          <div className="xl:col-span-1 space-y-6 flex flex-col h-full overflow-y-auto custom-scrollbar pr-2 pb-24 md:pb-2">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 print:bg-none print:text-black print:shadow-none print:border">
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <h2 className="font-bold text-xl opacity-90">{state.tripName || 'Trip Summary'}</h2>
                          {state.clientName && <div className="text-sm text-indigo-100 mt-0.5 opacity-80">Prepared for: {state.clientName}</div>}
                          {daysUntil !== null && (
                              <div className="text-indigo-100 text-sm mt-1 font-medium flex items-center gap-1">
                                  <Timer className="w-4 h-4"/> {daysUntil > 0 ? `${daysUntil} days to go!` : daysUntil === 0 ? "Departing today!" : `Day ${Math.abs(daysUntil)} of your trip`}
                              </div>
                          )}
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10"><div className="text-xs text-indigo-100 uppercase tracking-wider font-bold mb-1">Duration</div><div className="text-2xl font-extrabold">{duration} Days</div></div>
                      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10"><div className="text-xs text-indigo-100 uppercase tracking-wider font-bold mb-1">Stops</div><div className="text-2xl font-extrabold">{state.stops.length}</div></div>
                      {!isClientMode && <div onClick={() => setActiveTab('packing')} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 cursor-pointer hover:bg-white/20 transition-colors group"><div className="text-xs text-indigo-100 uppercase tracking-wider font-bold mb-1 flex items-center gap-1">Packing <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"/></div><div className="text-2xl font-extrabold">{packingProgress}%</div><div className="h-1.5 bg-indigo-900/30 rounded-full mt-2 overflow-hidden"><div className="h-full bg-white" style={{width: `${packingProgress}%`}}></div></div></div>}
                      {!hideCosts && <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10"><div className="text-xs text-indigo-100 uppercase tracking-wider font-bold mb-1">Total Cost</div><div className="text-2xl font-extrabold">{formatCurrency(grandTotal, state.homeCurrency)}</div></div>}
                  </div>
                  {!isClientMode && <button onClick={() => { setAiModalOpen(true); }} className="w-full mt-6 bg-white text-indigo-600 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"><Wand2 className="w-4 h-4"/> AI Trip Planner</button>}
              </div>
              <div className="space-y-4">
                  <h3 className="font-bold text-slate-700 px-1">Your Timeline</h3>
                  {timelineItems.map((item: any, i) => {
                      if (item.type === 'flight') {
                          const f = item as Flight;
                          return (
                              <div key={item.id} className="flex gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl items-center shadow-sm">
                                  <div className="w-10 h-10 p-2 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                      {item.logo ? <img src={item.logo} alt={item.airline} className="w-full h-full object-contain" /> : <Plane className="w-5 h-5"/>}
                                  </div>
                                  <div className="flex-1">
                                      <div className="text-xs font-bold text-blue-500 mb-0.5">Flight • {new Date(item.departure).toLocaleDateString()}</div>
                                      <div className="font-bold text-slate-700">{item.airline}</div>
                                      <div className="text-xs text-slate-500 font-bold">{f.fromIata || f.from} ➝ {f.toIata || f.to}</div>
                                  </div>
                              </div>
                          );
                      }
                      const s = item as Stop;
                      return (
                      <div key={s.id} ref={el => { itemRefs.current[s.id] = el; }} className="group transition-all duration-300">
                          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                               <div className="flex justify-between items-start">
                                   <div className="flex gap-4">
                                       <div className="flex-shrink-0 w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-lg">{s.seq}</div>
                                       <div>
                                           <h3 className="font-bold text-lg text-slate-800">{s.place}</h3>
                                           <div className="text-sm font-medium text-slate-500 mt-1 bg-slate-50 inline-block px-2 py-0.5 rounded">{s.start} — {s.end}</div>
                                           <div className="text-sm text-slate-600 mt-3 flex items-center gap-2"><Home className="w-4 h-4 text-slate-400"/> {s.accommodation || 'Accommodation TBD'}</div>
                                       </div>
                                   </div>
                                   {!isClientMode && <button onClick={() => { setDetailEditId(s.id); setDetailFormData(s); }} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4"/></button>}
                               </div>
                               <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2"><button onClick={() => { setActiveTab('daybyday'); setActiveDayKey(s.start); }} className="flex-1 text-xs font-bold bg-slate-50 text-slate-600 py-2.5 rounded-xl hover:bg-slate-100 transition-colors">Day Plan</button></div>
                          </div>
                      </div>
                  )})}
              </div>
          </div>
          <div className="xl:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px] hidden md:block print:block print:h-auto"><Map destinations={state.destinations} stops={state.stops} flights={state.flights} onMarkerClick={scrollToStop} /></div>
      </div>
  );
  };

  const FlightsView = () => (
      <div className="h-full flex flex-col pb-20 md:pb-0 animate-fade-in-up">
           <DashboardHeader title="Flights" icon={Plane} subtitle="Manage flights and costs" rightElement={!isClientMode && <Button onClick={() => { setFlightFormData({cost: {amount:0, currency: state.homeCurrency}}); setNewFlightModal(true); }} className="py-2 text-sm">+ Add Flight</Button>} />
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar flex-1 pr-2">
               {state.flights.length === 0 ? <EmptyState icon={Plane} title="No flights" description="Add your flights to track costs and times." action={!isClientMode && <Button onClick={() => setNewFlightModal(true)} variant="secondary">Add Flight</Button>} /> : 
               state.flights.map(f => (
                   <div key={f.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all relative overflow-hidden group h-fit">
                       <div className="flex gap-6">
                           <div className="flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <div>
                                        <div className="font-bold text-xl text-slate-800">{f.airline}</div>
                                        <div className="font-mono text-slate-400 text-sm">{f.flightNumber}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="text-center"><div className="text-3xl font-black text-slate-700">{f.fromIata || f.from.substring(0,3).toUpperCase()}</div><div className="text-xs text-slate-400 font-medium">{f.from}</div></div>
                                    <div className="flex-1 border-b-2 border-dashed border-slate-200 relative">
                                         <Plane className="w-5 h-5 text-slate-300 absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-0.5"/>
                                    </div>
                                    <div className="text-center"><div className="text-3xl font-black text-slate-700">{f.toIata || f.to.substring(0,3).toUpperCase()}</div><div className="text-xs text-slate-400 font-medium">{f.to}</div></div>
                                </div>
                                <div className="flex justify-between items-center flex-wrap gap-2">
                                    <div className="text-sm font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">Dep: {new Date(f.departure).toLocaleString(undefined, {dateStyle:'short', timeStyle:'short'})}</div>
                                    {f.arrival && <div className="text-sm font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg">Arr: {new Date(f.arrival).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (Local)</div>}
                                    {!hideCosts && <div className="font-bold text-indigo-600 text-xl ml-auto">{formatCurrency(f.cost.amount, f.cost.currency)}</div>}
                                </div>
                           </div>
                           <div className="w-24 h-24 bg-slate-50 rounded-2xl border border-slate-100 p-2 flex items-center justify-center flex-shrink-0">
                                {f.logo ? <img src={f.logo} alt={f.airline} className="w-full h-full object-contain mix-blend-multiply" /> : <Plane className="w-10 h-10 text-slate-300"/>}
                           </div>
                       </div>
                       
                       {!isClientMode && <div className="flex gap-2 mt-6 pt-4 border-t border-slate-50">
                            <button onClick={() => setState(s => ({...s, flights: s.flights.filter(x => x.id !== f.id)}))} className="flex-1 py-2 border border-slate-200 rounded-xl font-bold text-sm text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-colors">Remove</button>
                            <button onClick={() => togglePaid(f.id)} className={`flex-[2] py-2 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${state.paidItemIds?.includes(f.id) ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100'}`}>
                                {state.paidItemIds?.includes(f.id) ? '✓ Paid' : 'Mark as Paid'}
                            </button>
                       </div>}
                   </div>
               ))}
           </div>
      </div>
  );

  const LinksView = () => {
      const [newLink, setNewLink] = useState({title: '', url: ''});
      return (
          <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0 h-full flex flex-col animate-fade-in-up">
              <DashboardHeader title="Important Links" icon={LinkIcon} subtitle="Tickets, visas, and reservations" />
              {!isClientMode && <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                   <div className="flex flex-col md:flex-row gap-3">
                       <input className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Title (e.g., Tickets)" value={newLink.title} onChange={e => setNewLink({...newLink, title: e.target.value})}/>
                       <input className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="URL (https://...)" value={newLink.url} onChange={e => setNewLink({...newLink, url: e.target.value})}/>
                       <button onClick={() => {
                           if(newLink.title && newLink.url) {
                               setState(s => ({...s, links: [...(s.links || []), {id: crypto.randomUUID(), ...newLink}]}));
                               setNewLink({title:'', url:''});
                           }
                       }} className="bg-indigo-600 text-white px-6 py-3 md:py-0 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Add</button>
                   </div>
              </div>}
              <div className="grid grid-cols-1 gap-4 overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {(state.links || []).length === 0 && <EmptyState icon={LinkIcon} title="No links" description="Store your tickets and reservations here." />}
                  {(state.links || []).map(link => (
                      <div key={link.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex justify-between items-center hover:shadow-md transition-shadow group hover:border-indigo-100">
                          <div className="flex items-center gap-4 overflow-hidden">
                              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0 text-indigo-600"><LinkIcon className="w-6 h-6"/></div>
                              <div className="min-w-0">
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-slate-800 hover:text-indigo-600 transition-colors flex items-center gap-2 truncate">
                                    {link.title} <ExternalLink className="w-3 h-3 opacity-50 flex-shrink-0"/>
                                </a>
                                <div className="text-xs text-slate-400 truncate max-w-[200px] md:max-w-md">{link.url}</div>
                              </div>
                          </div>
                          {!isClientMode && <button onClick={() => setState(s => ({...s, links: s.links.filter(l => l.id !== link.id)}))} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-colors flex-shrink-0"><Trash2 className="w-5 h-5"/></button>}
                      </div>
                  ))}
              </div>
          </div>
      )
  };

  const BudgetView = () => {
      if (isClientMode) return null; 

      const chartData = [
          { name: 'Flights', value: state.flights.reduce((a, f) => a + getConvertedCost(f.cost), 0) },
          { name: 'Hotels', value: state.stops.reduce((a, s) => a + getConvertedCost(s.hotelCost), 0) },
          { name: 'Transport', value: state.stops.reduce((a, s) => a + getConvertedCost(s.travelToThisStop?.cost), 0) },
          { name: 'Activities', value: Object.values(state.dayPlans).flatMap((p: DayPlan) => p.activities).reduce((a: number, act: any) => a + getConvertedCost(act.cost), 0) },
          { name: 'Other', value: state.expenses.reduce((a, e) => a + getConvertedCost({ amount: e.amount, currency: e.currency}), 0) }
      ].filter(d => d.value > 0);
      
      const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#64748b'];
      const plannedItems = [
          ...state.flights.map(f => ({id: f.id, desc: `Flight: ${f.airline}`, cost: f.cost, type: 'flight', date: f.departure.split('T')[0]})),
          ...state.stops.map(s => ({id: s.id, desc: `Hotel: ${s.place}`, cost: s.hotelCost, type: 'hotel', date: s.start}))
      ];
      const mergedTransactions = [
          ...state.expenses.map(e => ({...e, type: 'expense', isPaid: true})),
          ...plannedItems.map(p => ({...p, isPaid: state.paidItemIds?.includes(p.id)}))
      ].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const val = parseFloat(e.target.value);
          if (val < 0) return; 
          setState(s => ({...s, totalBudget: isNaN(val) ? 0 : val}));
      };

      return (
          <div className="space-y-6 max-w-6xl mx-auto pb-20 md:pb-0 h-full flex flex-col animate-fade-in-up">
              <DashboardHeader title="Budget Overview" icon={DollarSign} subtitle="Manage expenses and stay on track." />
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-end mb-4">
                      <div><div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status</div><div className={`text-xl font-bold ${state.totalBudget - grandTotal < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{state.totalBudget - grandTotal < 0 ? 'Over Budget' : 'Within Budget'}</div></div>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-xl">
                          <div className="hidden sm:block px-2 text-sm text-slate-500 font-medium">Total:</div>
                          <input type="number" min="0" className="bg-white text-slate-900 w-24 font-bold text-right outline-none" value={state.totalBudget === 0 ? '' : state.totalBudget} onChange={handleBudgetChange} placeholder="0" />
                          <span className="font-bold text-indigo-600 text-sm pr-2">{state.homeCurrency}</span>
                      </div>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-2 relative"><div className={`h-full transition-all duration-1000 ease-out ${budgetProgress > 100 ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min(budgetProgress, 100)}%` }}></div></div>
                  <div className="flex justify-between text-sm font-medium text-slate-500"><span>Planned: {formatCurrency(grandTotal, state.homeCurrency)}</span><span>Total: {formatCurrency(state.totalBudget, state.homeCurrency)}</span></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col"><h3 className="font-bold text-lg mb-4">Cost Distribution</h3><div className="flex-1 min-h-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><ReTooltip formatter={(val: number) => formatCurrency(val, state.homeCurrency)} /><Legend verticalAlign="bottom" height={36}/></PieChart></ResponsiveContainer></div></div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px] lg:h-auto"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Transactions</h3><button onClick={() => setNewExpenseModal(true)} className="text-indigo-600 text-sm font-medium hover:bg-indigo-50 px-3 py-1 rounded-lg transition-colors">+ Expense</button></div><div className="space-y-2 overflow-y-auto custom-scrollbar pr-2 flex-1">{mergedTransactions.map((t: any, i) => (<div key={i} className={`flex justify-between items-center p-3 rounded-xl border ${t.isPaid ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}><div><div className="font-medium text-slate-700">{t.desc || t.description}</div><div className="text-xs text-slate-400">{t.date} • {t.type === 'expense' ? 'Expense' : 'Planned'}</div></div><div className="flex items-center gap-3"><span className="font-bold text-slate-800">{formatCurrency(t.cost?.amount || t.amount, t.cost?.currency || t.currency)}</span>{t.type !== 'expense' && (<button onClick={() => togglePaid(t.id)} className={`p-1 rounded-full ${t.isPaid ? 'text-emerald-600 bg-emerald-100' : 'text-slate-300 hover:bg-slate-100'}`}><Check className="w-4 h-4"/></button>)}</div></div>))}{mergedTransactions.length === 0 && <div className="text-center text-slate-400 text-sm italic py-4">No expenses yet.</div>}</div></div>
              </div>
          </div>
      );
  };
  
  const PackingView = () => {
      const addTemplate = (type: string) => {
          const templates: Record<string, PackingItem[]> = {
              'Weekend': [{id:'1', text:'Underwear x3', category:'Clothing', packed:false}, {id:'2', text:'Toothbrush', category:'Toiletries', packed:false}],
              'Sun': [{id:'3', text:'Sunscreen', category:'Health', packed:false}, {id:'4', text:'Swimwear', category:'Clothing', packed:false}],
              'Basic': [{id:'5', text:'Passport', category:'Documents', packed:false}, {id:'6', text:'Charger', category:'Electronics', packed:false}]
          };
          if(templates[type]) setState(s => ({...s, packingList: [...s.packingList, ...templates[type].map(i => ({...i, id: crypto.randomUUID()})) ]}));
      };
      
      const packedCount = state.packingList.filter(i => i.packed).length;
      const progress = state.packingList.length > 0 ? (packedCount / state.packingList.length) * 100 : 0;

      const groupedList = useMemo(() => {
          const groups: Record<string, PackingItem[]> = {};
          state.packingList.forEach(item => {
              const cat = item.category || 'General';
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push(item);
          });
          return groups;
      }, [state.packingList]);

      return (
          <div className="max-w-4xl mx-auto space-y-6 h-full flex flex-col pb-20 md:pb-0 animate-fade-in-up">
              <DashboardHeader title="Packing List" icon={Briefcase} subtitle="Never forget anything important" rightElement={!isClientMode && <div className="flex gap-2">{['Weekend', 'Sun', 'Basic'].map(t => (<button key={t} onClick={() => addTemplate(t)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm">+ {t}</button>))}</div>} />
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-3"><span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Progress</span><span className="text-sm font-bold text-indigo-600">{Math.round(progress)}%</span></div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-500" style={{width: `${progress}%`}}></div></div>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                   <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                       {state.packingList.length === 0 ? <EmptyState icon={Luggage} title="List is empty" description="Start with a template or add items manually." /> : (
                           (Object.entries(groupedList) as [string, PackingItem[]][]).map(([category, items]) => (
                               <div key={category}>
                                   <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div>{category}</h4>
                                   <div className="space-y-2">
                                       {items.map(item => (
                                           <div key={item.id} className={`flex items-center p-3 rounded-xl transition-all group border ${item.packed ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'}`}>
                                               <button onClick={() => setState(s => ({...s, packingList: s.packingList.map(i => i.id === item.id ? {...i, packed: !i.packed} : i)}))} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all flex-shrink-0 ${item.packed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-500'}`}>{item.packed && <Check className="w-3.5 h-3.5"/>}</button>
                                               <span className={`flex-1 font-medium ${item.packed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                                               {!isClientMode && <button className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setState(s => ({...s, packingList: s.packingList.filter(i => i.id !== item.id)}))}><Trash2 className="w-5 h-5"/></button>}
                                           </div>
                                       ))}
                                   </div>
                               </div>
                           ))
                       )}
                   </div>
                   {!isClientMode && <div className="p-4 border-t border-slate-100 bg-slate-50"><div className="relative"><input id="newItem" className="w-full p-4 pr-16 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900" placeholder="Add new item..." onKeyDown={(e) => {if(e.key === 'Enter') {const val = (e.target as HTMLInputElement).value; if(val) {setState(s => ({...s, packingList: [...s.packingList, {id: crypto.randomUUID(), text: val, category: 'General', packed: false}]})); (e.target as HTMLInputElement).value = '';}}}}/><div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">ENTER</div></div></div>}
              </div>
          </div>
      );
  };

  const DayByDayView = () => {
      const sortedDates = Object.keys(state.dayPlans).sort();
      const [addingActivityTo, setAddingActivityTo] = useState<{date: string, block: string} | null>(null);
      const [newActivityName, setNewActivityName] = useState('');
      const [dragOverId, setDragOverId] = useState<string | null>(null); 

      useEffect(() => {
          if (activeDayKey) {
              const el = document.getElementById(`day-${activeDayKey}`);
              if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-indigo-400', 'ring-offset-4');
                  setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400', 'ring-offset-4'), 2000);
              }
          }
      }, [activeDayKey]);

      const CATEGORY_CONFIG: Record<string, { icon: any, color: string, bg: string, label: string }> = {
          'sightseeing': { icon: Camera, color: 'text-rose-500', bg: 'bg-rose-50', label: 'Sightseeing' },
          'food': { icon: Utensils, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Food & Drink' },
          'adventure': { icon: Mountain, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Adventure' },
          'relax': { icon: Palmtree, color: 'text-cyan-500', bg: 'bg-cyan-50', label: 'Relax' },
          'culture': { icon: Building2, color: 'text-purple-500', bg: 'bg-purple-50', label: 'Culture' },
          'shopping': { icon: Ticket, color: 'text-pink-500', bg: 'bg-pink-50', label: 'Shopping' },
          'transport': { icon: Compass, color: 'text-slate-500', bg: 'bg-slate-50', label: 'Travel' },
      };

      const onDragStart = (e: React.DragEvent, actId: string) => { if(isClientMode) return; e.dataTransfer.setData("actId", actId); };
      
      const onDrop = (e: React.DragEvent, date: string, timeBlock: Activity['timeBlock']) => { 
          if(isClientMode) return;
          setDragOverId(null);
          const actId = e.dataTransfer.getData("actId"); 
          
          if(date && actId) {
             const newDayPlans = { ...state.dayPlans };
             let activityData: Activity | null = null;

             for (const d of Object.keys(newDayPlans)) {
                 const idx = newDayPlans[d].activities.findIndex(a => a.id === actId);
                 if (idx !== -1) {
                     activityData = newDayPlans[d].activities[idx];
                     newDayPlans[d].activities.splice(idx, 1);
                     break;
                 }
             }

             if (activityData) {
                 activityData.timeBlock = timeBlock;
                 newDayPlans[date].activities.push(activityData);
                 setState(s => ({...s, dayPlans: newDayPlans}));
             }
          }
      };

      const handleAddActivity = (date: string, block: string) => {
          if (newActivityName.trim()) {
              const updated = {...state.dayPlans};
              const stopForDay = state.stops.find(s => s.id === updated[date].stopId);
              updated[date].activities.push({ id: crypto.randomUUID(), name: newActivityName, timeBlock: block as any, cost: {amount:0, currency: state.homeCurrency}, status: 'idea', lat: stopForDay?.lat, lng: stopForDay?.lng, category: 'sightseeing' });
              setState(s => ({...s, dayPlans: updated})); setNewActivityName(''); setAddingActivityTo(null);
          }
      };
      
      const toggleActivityStatus = (e: React.MouseEvent, date: string, act: Activity) => {
          e.stopPropagation();
          const nextStatus = act.status === 'idea' ? 'booked' : act.status === 'booked' ? 'paid' : 'idea';
          const updated = {...state.dayPlans};
          updated[date].activities = updated[date].activities.map(a => a.id === act.id ? {...a, status: nextStatus} : a);
          setState(s => ({...s, dayPlans: updated}));
      };

      const openActivityEdit = (date: string, act: Activity) => { 
          if(!isClientMode) { 
              setActiveDayKey(date); 
              setActivityFormData(act); 
              setActivityModalOpen(true); 
          } 
      };

      const saveActivity = () => { 
          if(activeDayKey && activityFormData.id) { 
              const updated = {...state.dayPlans}; 
              updated[activeDayKey].activities = updated[activeDayKey].activities.map(a => a.id === activityFormData.id ? activityFormData : a); 
              setState(s => ({...s, dayPlans: updated})); 
              setActivityModalOpen(false); 
          }
      };
      
      const TIME_BLOCKS = [
          {id: 'morning', label: 'Morning', icon: Sun, color: 'text-orange-500', bg: 'bg-orange-50'}, 
          {id: 'afternoon', label: 'Afternoon', icon: Coffee, color: 'text-blue-500', bg: 'bg-blue-50'}, 
          {id: 'evening', label: 'Evening', icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-50'},
          {id: 'unplanned', label: 'Ideas & Notes', icon: Lightbulb, color: 'text-slate-500', bg: 'bg-slate-50'}
      ];

      return (
          <div className="flex h-full gap-6 pb-20 md:pb-0 relative animate-fade-in-up">
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2 scroll-smooth pb-10" id="itinerary-stream">
                  <DashboardHeader title="Itinerary" icon={Calendar} subtitle="Your trip timeline" />
                  
                  {sortedDates.map((date) => {
                      const plan = state.dayPlans[date];
                      const stop = state.stops.find(s => s.id === plan.stopId);
                      const isRest = plan.status === 'rest';
                      const isComplete = plan.status === 'complete';
                      
                      const dayActivities = [...plan.activities].sort((a,b) => {
                          if(a.time && b.time) return a.time.localeCompare(b.time);
                          if(a.time) return -1; if(b.time) return 1; return 0;
                      });

                      const dailyCost = dayActivities.reduce((sum, act) => sum + getConvertedCost(act.cost), 0);
                      const dailyBudget = stop?.dailyBudget ? getConvertedCost(stop.dailyBudget) : 0;
                      const overBudget = dailyBudget > 0 && dailyCost > dailyBudget;

                      return (
                          <div key={date} id={`day-${date}`} className="flex gap-4 group transition-all duration-300">
                              <div className="flex flex-col items-center mt-1 flex-shrink-0 w-14">
                                   <div className={`w-12 text-center rounded-xl py-1 ${activeDayKey === date ? 'bg-indigo-600 text-white shadow-lg' : ''}`}>
                                       <div className={`text-[10px] font-bold uppercase ${activeDayKey === date ? 'text-indigo-200' : 'text-slate-400'}`}>{new Date(date).toLocaleDateString('en-US', {weekday: 'short'})}</div>
                                       <div className={`text-xl font-black ${activeDayKey === date ? 'text-white' : 'text-slate-800'}`}>{new Date(date).getDate()}</div>
                                   </div>
                                   <div className="w-px flex-1 bg-slate-200 my-2 group-last:hidden"></div>
                              </div>
                              
                              <div className={`flex-1 bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all p-6 mb-4 relative overflow-hidden ${isRest ? 'bg-blue-50/30 border-blue-100' : 'border-slate-100'}`}>
                                   {isRest && <div className="absolute top-0 right-0 bg-blue-100 text-blue-600 px-3 py-1 rounded-bl-xl text-xs font-bold">Rest Day</div>}
                                   {isComplete && <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-600 px-3 py-1 rounded-bl-xl text-xs font-bold">Complete</div>}
                                   
                                   <div className="flex justify-between items-start mb-6">
                                       <div>
                                           <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                               {new Date(date).toLocaleDateString(undefined, {month: 'long', day:'numeric'})}
                                               {(!hideCosts && dailyBudget > 0) && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${overBudget ? 'bg-red-50 text-red-500 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{formatCurrency(dailyCost, state.homeCurrency)} / {formatCurrency(dailyBudget, state.homeCurrency)}</span>}
                                           </h3>
                                           <div className="flex items-center gap-2 text-sm text-slate-500 mt-1"><MapPin className="w-4 h-4"/> {stop?.place}</div>
                                       </div>
                                       {!isClientMode && (
                                           <select 
                                                value={plan.status} 
                                                onChange={(e) => {const updated = {...state.dayPlans}; updated[date].status = e.target.value as any; setState(s => ({...s, dayPlans: updated}));}} 
                                                className="bg-transparent text-xs font-bold text-slate-400 outline-none hover:text-indigo-600 cursor-pointer text-right"
                                           >
                                                <option value="default">Planning</option>
                                                <option value="complete">Complete</option>
                                                <option value="rest">Rest Day</option>
                                           </select>
                                       )}
                                   </div>
                                   
                                   <div className="space-y-4">
                                       {TIME_BLOCKS.map(block => {
                                           const blockActivities = dayActivities.filter(a => a.timeBlock === block.id);
                                           if (isClientMode && blockActivities.length === 0) return null;

                                           const dragId = `${date}|${block.id}`;
                                           return (
                                               <div 
                                                   key={block.id}
                                                   onDragOver={e => { e.preventDefault(); setDragOverId(dragId); }} 
                                                   onDrop={e => onDrop(e, date, block.id as any)}
                                                   onDragLeave={() => setDragOverId(null)}
                                                   className={`rounded-xl transition-all ${dragOverId === dragId ? 'bg-indigo-50 ring-2 ring-indigo-200 p-2' : ''}`}
                                               >
                                                   {(blockActivities.length > 0 || !isClientMode) && (
                                                       <div className="flex items-center gap-2 mb-2">
                                                            <div className={`p-1 rounded ${block.bg} ${block.color}`}><block.icon className="w-3 h-3"/></div>
                                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{block.label}</div>
                                                       </div>
                                                   )}
                                                   
                                                   <div className="space-y-2">
                                                       {blockActivities.map((act, idx) => {
                                                            const catConfig = CATEGORY_CONFIG[act.category || 'sightseeing'] || CATEGORY_CONFIG['sightseeing'];
                                                            const CatIcon = catConfig.icon;
                                                            return (
                                                                <div 
                                                                    key={act.id} 
                                                                    draggable={!isClientMode}
                                                                    onDragStart={(e) => onDragStart(e, act.id)}
                                                                    onClick={() => openActivityEdit(date, act)}
                                                                    className={`relative bg-white border rounded-xl p-3 flex gap-3 items-start group/item hover:shadow-sm hover:border-indigo-200 transition-all cursor-pointer ${act.status === 'idea' ? 'border-dashed border-slate-300 bg-slate-50/50' : 'border-slate-200'}`}
                                                                >
                                                                    {!isClientMode && <div className="mt-1 text-slate-300 cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4"/></div>}
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex justify-between items-start">
                                                                            <span className={`font-bold text-sm ${act.status === 'idea' ? 'text-slate-500 italic' : 'text-slate-700'}`}>{act.name}</span>
                                                                            {act.time && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">{act.time}</span>}
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2 mt-1.5">
                                                                            <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${catConfig.bg} ${catConfig.color}`}><CatIcon className="w-3 h-3"/> {catConfig.label}</span>
                                                                            {(act.cost.amount > 0 && !hideCosts) && <span className="text-[10px] font-medium text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{formatCurrency(act.cost.amount, act.cost.currency)}</span>}
                                                                            <div onClick={(e) => toggleActivityStatus(e, date, act)} className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full cursor-pointer border ${act.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : act.status === 'booked' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                                                                                {act.status === 'paid' ? <CheckCircle2 className="w-3 h-3"/> : act.status === 'booked' ? <CreditCard className="w-3 h-3"/> : <CircleDashed className="w-3 h-3"/>}
                                                                                {act.status === 'idea' ? 'Idea' : act.status === 'booked' ? 'Booked' : 'Paid'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                       })}
                                                       
                                                       {!isClientMode && (
                                                           addingActivityTo?.date === date && addingActivityTo?.block === block.id ? (
                                                               <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                                                   <input 
                                                                      autoFocus 
                                                                      className="flex-1 p-2 border border-indigo-300 rounded-lg text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200 shadow-sm" 
                                                                      placeholder="Activity name..." 
                                                                      value={newActivityName} 
                                                                      onChange={e => setNewActivityName(e.target.value)} 
                                                                      onKeyDown={e => e.key === 'Enter' && handleAddActivity(date, block.id)} 
                                                                    />
                                                                    <button onClick={() => handleAddActivity(date, block.id)} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 shadow-sm"><Check className="w-4 h-4"/></button>
                                                                    <button onClick={() => setAddingActivityTo(null)} className="text-slate-400 p-2 hover:text-slate-600"><X className="w-4 h-4"/></button>
                                                               </div>
                                                           ) : (
                                                               <button 
                                                                  onClick={() => { setAddingActivityTo({date, block: block.id}); setNewActivityName(''); }} 
                                                                  className="text-[10px] font-bold text-slate-300 hover:text-indigo-500 flex items-center gap-1 py-1 px-2 hover:bg-indigo-50 rounded transition-colors"
                                                               >
                                                                  <Plus className="w-3 h-3"/> Add Item
                                                               </button>
                                                           )
                                                       )}
                                                   </div>
                                               </div>
                                           )
                                       })}
                                   </div>
                              </div>
                          </div>
                      )
                  })}
              </div>

              <div className="hidden xl:flex w-[380px] flex-col gap-6 h-full sticky top-0 pt-2 pb-6">
                   <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative flex flex-col">
                       <div className="flex-1 relative">
                           <Map stops={state.stops} flights={state.flights} />
                       </div>
                       <div className="p-4 border-t border-slate-50 bg-white/90 backdrop-blur-sm absolute bottom-0 left-0 right-0">
                           <h4 className="font-bold text-slate-700 text-sm mb-1">Route Map</h4>
                           <p className="text-xs text-slate-400">View your entire journey at a glance.</p>
                       </div>
                   </div>
              </div>

              {activityModalOpen && (
                  <Modal title="Edit Activity" onClose={() => setActivityModalOpen(false)}>
                      <div className="space-y-4">
                          <InputGroup label="Name"><input className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={activityFormData.name} onChange={e => setActivityFormData({...activityFormData, name: e.target.value})} /></InputGroup>
                          <div className="grid grid-cols-2 gap-4">
                              <InputGroup label="Time"><input type="time" className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={activityFormData.time || ''} onChange={e => setActivityFormData({...activityFormData, time: e.target.value})} /></InputGroup>
                              <InputGroup label="Category">
                                  <select className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium capitalize" value={activityFormData.category || 'sightseeing'} onChange={e => setActivityFormData({...activityFormData, category: e.target.value})}>
                                      {Object.keys(CATEGORY_CONFIG).map(k => <option key={k} value={k}>{CATEGORY_CONFIG[k].label}</option>)}
                                  </select>
                              </InputGroup>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <InputGroup label="Cost"><div className="flex"><input type="number" className="w-full p-3 border border-slate-200 rounded-l-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={activityFormData.cost?.amount} onChange={e => setActivityFormData({...activityFormData, cost: {...activityFormData.cost, amount: parseFloat(e.target.value)}})} /><select className="bg-white/70 backdrop-blur-sm border border-l-0 border-slate-200 p-2 rounded-r-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={activityFormData.cost?.currency} onChange={e => setActivityFormData({...activityFormData, cost: {...activityFormData.cost, currency: e.target.value}})}>{Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}</select></div></InputGroup>
                              <InputGroup label="Status">
                                  <select className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium capitalize" value={activityFormData.status || 'idea'} onChange={e => setActivityFormData({...activityFormData, status: e.target.value})}>
                                      <option value="idea">Idea (Planned)</option>
                                      <option value="booked">Booked (Reserved)</option>
                                      <option value="paid">Paid & Confirmed</option>
                                  </select>
                              </InputGroup>
                          </div>
                          <InputGroup label="Notes"><textarea className="w-full p-3 border border-slate-200 rounded-xl h-24 bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={activityFormData.notes || ''} onChange={e => setActivityFormData({...activityFormData, notes: e.target.value})} /></InputGroup>
                          <div className="flex justify-between pt-2">
                              <Button variant="danger" onClick={() => { if(activeDayKey) { setState(s => ({...s, dayPlans: {...s.dayPlans, [activeDayKey]: {...s.dayPlans[activeDayKey], activities: s.dayPlans[activeDayKey].activities.filter(a => a.id !== activityFormData.id)}}})); setActivityModalOpen(false); } }}>Delete</Button>
                              <div className="flex gap-2"><Button variant="secondary" onClick={() => setActivityModalOpen(false)}>Cancel</Button><Button onClick={saveActivity}>Save</Button></div>
                          </div>
                      </div>
                  </Modal>
              )}
          </div>
      );
  };
  
  const ToolsView = () => {
    const [calcAmount, setCalcAmount] = useState(1);
    const [selectedCountry, setSelectedCountry] = useState(state.stops.length > 0 ? state.stops[0].place : '');
    const [phrases, setPhrases] = useState<any[]>([]);
    const [loadingPhrases, setLoadingPhrases] = useState(false);
    
    const uniqueCurrencies = useMemo(() => {
        const set = new Set<string>();
        state.stops.forEach(s => { if(s.hotelCost.currency !== state.homeCurrency) set.add(s.hotelCost.currency); });
        state.flights.forEach(f => { if(f.cost.currency !== state.homeCurrency) set.add(f.cost.currency); });
        return Array.from(set);
    }, [state.stops, state.flights, state.homeCurrency]);

    const uniquePlaces = useMemo(() => {
         const places = state.stops.map(s => s.place);
         return Array.from(new Set(places));
    }, [state.stops]);

    const handleGeneratePhrases = async () => {
        if (!selectedCountry) return;
        setLoadingPhrases(true);
        const res = await getPhrases(selectedCountry);
        setPhrases(res);
        setLoadingPhrases(false);
    };

    return (
        <div className="h-full flex flex-col pb-20 md:pb-0 animate-fade-in-up">
            <DashboardHeader title="Travel Tools" icon={Languages} subtitle="Useful utilities for your journey" />
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-10">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Calculator className="w-5 h-5"/></div>
                        <div><h3 className="font-bold text-slate-800">Currency Converter</h3><div className="text-xs text-slate-400">Live rates calculator</div></div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">My Currency</label>
                            <div className="flex items-center justify-between">
                                <span className="font-black text-2xl text-slate-700">{state.homeCurrency}</span>
                                <input type="number" value={calcAmount} onChange={e => setCalcAmount(parseFloat(e.target.value) || 0)} className="bg-transparent text-right font-bold text-2xl outline-none w-32" />
                            </div>
                        </div>
                        <div className="flex justify-center -my-2 relative z-10"><div className="bg-white border border-slate-200 p-1.5 rounded-full shadow-sm"><ArrowDown className="w-4 h-4 text-slate-400"/></div></div>
                        <div className="space-y-3">
                            {uniqueCurrencies.length === 0 && <div className="text-center text-slate-400 text-sm italic py-4">Add stops with different currencies to see them here.</div>}
                            {uniqueCurrencies.map(curr => {
                                const rate = (rates[curr] || 1) / (rates[state.homeCurrency] || 1);
                                const val = calcAmount * rate;
                                return (
                                <div key={curr} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0">
                                    <span className="font-bold text-slate-500">{curr}</span>
                                    <span className="font-bold text-xl text-slate-800">{new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(val)}</span>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 xl:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Languages className="w-5 h-5"/></div>
                        <div><h3 className="font-bold text-slate-800">AI Phrasebook</h3><div className="text-xs text-slate-400">Essential phrases for your trip</div></div>
                    </div>

                    <div className="flex gap-3 mb-6">
                        <select className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}>
                            {uniquePlaces.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <Button onClick={handleGeneratePhrases} loading={loadingPhrases} disabled={!selectedCountry}><Sparkles className="w-4 h-4"/> Generate</Button>
                    </div>

                    {phrases.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {phrases.map((p, i) => (
                                <div key={i} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 hover:bg-indigo-50 transition-colors">
                                    <div className="font-bold text-slate-800 text-lg mb-1">{p.translation}</div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-sm text-slate-500 font-medium">{p.text}</div>
                                        <div className="text-xs font-mono text-indigo-500 bg-white px-2 py-1 rounded-lg border border-indigo-100 flex items-center gap-1"><Volume2 className="w-3 h-3"/> {p.pronunciation}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                             <Languages className="w-10 h-10 text-slate-300 mx-auto mb-2"/>
                             <p className="text-slate-500 text-sm">Select a location to generate useful phrases.</p>
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 xl:col-span-3">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Cloud className="w-5 h-5"/></div>
                        <div><h3 className="font-bold text-slate-800">Current Conditions</h3><div className="text-xs text-slate-400">Weather at your destinations</div></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {weather ? (
                            <div className="bg-blue-500 text-white p-5 rounded-2xl shadow-lg shadow-blue-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-20"><CloudSun className="w-20 h-20"/></div>
                                <div className="relative z-10">
                                    <div className="text-blue-100 text-sm font-bold mb-1">Current Stop</div>
                                    <div className="text-3xl font-black mb-1">{weather.temperature_2m_max[0]}°C</div>
                                    <div className="text-xs font-medium opacity-80">High / {weather.temperature_2m_max[0]}°C</div>
                                </div>
                            </div>
                        ) : (
                             <div className="bg-slate-100 p-5 rounded-2xl flex items-center justify-center text-slate-400 text-sm">No weather data</div>
                        )}
                        {uniquePlaces.slice(0,3).map(place => (
                            <div key={place} className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between">
                                <div className="font-bold text-slate-700 truncate">{place}</div>
                                <div className="text-xs text-slate-400">Tap to view forecast</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const SidebarItem = ({ id, icon: Icon, label }: any) => (
      <button onClick={() => setActiveTab(id)} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 font-medium ${activeTab === id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><Icon className={`w-5 h-5 ${activeTab === id ? 'text-white' : 'text-slate-400'}`} /><span>{label}</span></button>
  );

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
        <AiAssistant tripState={state} />

        <div className="w-64 bg-white border-r border-slate-100 flex-col hidden md:flex p-6 print:hidden">
            <div className="flex items-center gap-3 mb-8 px-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg" style={{ backgroundColor: agencyProfile.primaryColor || '#4f46e5' }}>
                   {agencyProfile.logoUrl ? <img src={agencyProfile.logoUrl} className="w-full h-full object-cover rounded-xl"/> : agencyProfile.name.charAt(0)}
                </div>
                <div><h1 className="font-extrabold text-slate-800 leading-tight truncate w-32" title={agencyProfile.name}>{agencyProfile.name}</h1><p className="text-xs text-slate-400 font-medium">Agency Hub</p></div>
            </div>
            {!isClientMode && <div className="mb-6 px-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Currency</div>
                <select className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" value={state.homeCurrency} onChange={e => setState(s => ({...s, homeCurrency: e.target.value}))}>
                    {Object.entries(CURRENCIES).map(([code, name]) => <option key={code} value={code}>{code} - {name}</option>)}
                </select>
            </div>}
            
            <div className="space-y-2 flex-1">
                <SidebarItem id="route" icon={LayoutGrid} label="Overview" />
                <SidebarItem id="daybyday" icon={Calendar} label="Itinerary" />
                {!isClientMode && <SidebarItem id="budget" icon={DollarSign} label="Budget" />}
                <SidebarItem id="packing" icon={Briefcase} label="Packing List" />
                <SidebarItem id="flights" icon={Plane} label="Flights" />
                <SidebarItem id="links" icon={LinkIcon} label="Links" />
                <SidebarItem id="tools" icon={Languages} label="Tools" />
            </div>

            <div className="mt-auto pt-6 border-t border-slate-50">
                {!isClientMode && (
                    <button onClick={onPreviousStep} className="w-full flex items-center gap-3 text-sm px-3 py-2.5 rounded-xl transition-all font-bold mb-3 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200">
                        <MapIcon className="w-4 h-4"/> Edit Route & Stops
                    </button>
                )}
                <button onClick={toggleClientMode} className={`w-full flex items-center gap-3 text-sm px-3 py-2.5 rounded-xl transition-all font-bold mb-3 ${isClientMode ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                    {isClientMode ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                    {isClientMode ? 'Agent View' : 'Client View'}
                </button>
                {isClientMode && (
                    <div className="flex items-center gap-2 mb-3 px-1">
                         <span className="text-xs font-bold text-slate-500 flex-1">Hide Costs</span>
                         <button onClick={() => setHideCosts(!hideCosts)} className={`w-10 h-5 rounded-full relative transition-colors ${hideCosts ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                             <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${hideCosts ? 'left-[22px]' : 'left-0.5'}`}></div>
                         </button>
                    </div>
                )}
                
                <div className="flex items-center gap-2 px-2 mb-4">
                    <button onClick={handleExport} className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 text-sm px-2 transition-colors font-bold"><Save className="w-4 h-4"/> Save Trip File</button>
                </div>

                <button onClick={() => window.print()} className="flex items-center gap-3 text-slate-400 hover:text-slate-700 text-sm px-2 transition-colors font-medium mb-2"><Printer className="w-4 h-4"/> Print Itinerary</button>
                <button onClick={onBack} className="flex items-center gap-3 text-slate-400 hover:text-red-600 text-sm px-2 transition-colors font-medium"><LogOut className="w-4 h-4"/> Exit Trip</button>
            </div>
        </div>
        
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-between items-center px-6 py-3 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] print:hidden">
             <button onClick={() => setActiveTab('route')} className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === 'route' ? 'text-indigo-600 bg-indigo-50 scale-110 shadow-lg shadow-indigo-100' : 'text-slate-400'}`}><LayoutGrid className="w-6 h-6"/></button>
             <button onClick={() => setActiveTab('daybyday')} className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === 'daybyday' ? 'text-indigo-600 bg-indigo-50 scale-110 shadow-lg shadow-indigo-100' : 'text-slate-400'}`}><Calendar className="w-6 h-6"/></button>
             {!isClientMode && <button onClick={() => setActiveTab('budget')} className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === 'budget' ? 'text-indigo-600 bg-indigo-50 scale-110 shadow-lg shadow-indigo-100' : 'text-slate-400'}`}><DollarSign className="w-6 h-6"/></button>}
             <button onClick={() => setActiveTab('tools')} className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === 'tools' ? 'text-indigo-600 bg-indigo-50 scale-110 shadow-lg shadow-indigo-100' : 'text-slate-400'}`}><Languages className="w-6 h-6"/></button>
             <button onClick={onBack} className="p-2 rounded-2xl text-slate-400"><LogOut className="w-6 h-6"/></button>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 lg:p-10" key={activeTab}>
                {activeTab === 'route' && <RouteView />}
                {activeTab === 'budget' && <BudgetView />}
                {activeTab === 'flights' && <FlightsView />}
                {activeTab === 'packing' && <PackingView />}
                {activeTab === 'links' && <LinksView />}
                {activeTab === 'daybyday' && <DayByDayView />}
                {activeTab === 'tools' && <ToolsView />}
            </div>
        </div>
        
        {aiModalOpen && (
            <Modal title="AI Trip Planner" onClose={() => setAiModalOpen(false)}>
                 <div className="p-4 text-center space-y-4">
                    <Wand2 className="w-12 h-12 text-indigo-500 mx-auto"/>
                    <p>AI suggestions for your itinerary.</p>
                    <div className="space-y-3">
                        <textarea 
                            className="w-full p-3 border rounded-xl" 
                            placeholder="What are you looking for?"
                            value={aiPrefs.company}
                            onChange={e => setAiPrefs({...aiPrefs, company: e.target.value})}
                        />
                         <Button onClick={async () => {
                             setAiThinking(true);
                             try {
                                const res = await generateItinerarySuggestion(state.stops, aiPrefs.company);
                                alert(res);
                             } catch(e) { console.error(e); }
                             setAiThinking(false);
                             setAiModalOpen(false);
                         }} loading={aiThinking}>Generate</Button>
                    </div>
                 </div>
            </Modal>
        )}
        
        {newExpenseModal && (
            <Modal title="New Expense" onClose={() => setNewExpenseModal(false)}>
                 <div className="space-y-4">
                     <InputGroup label="Description">
                        <input className="w-full p-3 border rounded-xl bg-white/70 backdrop-blur-sm" id="expense-desc"/>
                     </InputGroup>
                     <InputGroup label="Amount">
                         <input type="number" className="w-full p-3 border rounded-xl bg-white/70 backdrop-blur-sm" id="expense-amount"/>
                     </InputGroup>
                     <Button onClick={() => {
                        const desc = (document.getElementById('expense-desc') as HTMLInputElement).value;
                        const amount = parseFloat((document.getElementById('expense-amount') as HTMLInputElement).value);
                        if(desc && amount) {
                            setState(s => ({...s, expenses: [...s.expenses, {
                                id: crypto.randomUUID(), 
                                description: desc, 
                                amount, 
                                currency: state.homeCurrency,
                                category: 'Other',
                                date: new Date().toISOString().split('T')[0],
                                isPaid: true
                            }]}));
                            setNewExpenseModal(false);
                        }
                     }}>Save</Button>
                 </div>
            </Modal>
        )}

        {newFlightModal && (
             <Modal title="New Flight" onClose={() => setNewFlightModal(false)}>
                  <div className="space-y-4">
                      <AirlineAutocomplete 
                                value={flightFormData.airline || ''} 
                                onChange={(val) => setFlightFormData({...flightFormData, airline: val})}
                                onSelect={(a) => setFlightFormData({...flightFormData, airline: a.name, logo: a.logo})}
                      />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <AirportAutocomplete 
                                        label="From" 
                                        value={flightFormData.from || ''} 
                                        onChange={(val) => setFlightFormData(prev => ({...prev, from: val}))}
                                        onSelect={(data) => setFlightFormData(prev => ({
                                            ...prev, 
                                            from: data.name,
                                            fromLat: data.lat, 
                                            fromLng: data.lng,
                                            fromIata: data.iata ? data.iata.toUpperCase() : prev.fromIata
                                        }))}
                                    />
                                </div>
                                <div className="w-20">
                                     <InputGroup label="IATA">
                                         <input className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-center font-black text-slate-700 uppercase" 
                                                maxLength={3} 
                                                placeholder="LHR"
                                                value={flightFormData.fromIata || ''} 
                                                onChange={e => setFlightFormData(prev => ({...prev, fromIata: e.target.value.toUpperCase()}))} />
                                     </InputGroup>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <AirportAutocomplete 
                                        label="To" 
                                        value={flightFormData.to || ''} 
                                        onChange={(val) => setFlightFormData(prev => ({...prev, to: val}))}
                                        onSelect={(data) => setFlightFormData(prev => ({
                                            ...prev, 
                                            to: data.name,
                                            toLat: data.lat, 
                                            toLng: data.lng,
                                            toIata: data.iata ? data.iata.toUpperCase() : prev.toIata
                                        }))}
                                    />
                                </div>
                                <div className="w-20">
                                     <InputGroup label="IATA">
                                         <input className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-center font-black text-slate-700 uppercase" 
                                                maxLength={3} 
                                                placeholder="JFK"
                                                value={flightFormData.toIata || ''} 
                                                onChange={e => setFlightFormData(prev => ({...prev, toIata: e.target.value.toUpperCase()}))} />
                                     </InputGroup>
                                </div>
                            </div>
                        </div>
                       <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Departure"><input type="datetime-local" className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={flightFormData.departure} onChange={e => setFlightFormData({...flightFormData, departure: e.target.value})}/></InputGroup>
                            <InputGroup label="Arrival (Local Time)"><input type="datetime-local" className="w-full p-3 border border-slate-200 rounded-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={flightFormData.arrival} onChange={e => setFlightFormData({...flightFormData, arrival: e.target.value})}/></InputGroup>
                       </div>
                       <InputGroup label="Cost">
                            <div className="flex">
                                <input type="number" className="w-full p-3 border rounded-l-xl bg-white/70 backdrop-blur-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={flightFormData.cost?.amount} onChange={e => setFlightFormData({...flightFormData, cost: {...(flightFormData.cost || {}), amount: parseFloat(e.target.value)}})} />
                                <select className="bg-white/70 backdrop-blur-sm border border-l-0 border-slate-200 p-2 rounded-r-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={flightFormData.cost?.currency || state.homeCurrency} onChange={e => setFlightFormData({...flightFormData, cost: {...(flightFormData.cost || {}), currency: e.target.value}})}>{Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}</select>
                            </div>
                       </InputGroup>
                       <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setNewFlightModal(false)}>Cancel</Button>
                            <Button onClick={() => {
                                if(flightFormData.airline) {
                                    setState(s => ({...s, flights: [...s.flights, {id: crypto.randomUUID(), ...flightFormData, fromIata: flightFormData.fromIata?.toUpperCase(), toIata: flightFormData.toIata?.toUpperCase(), cost: flightFormData.cost || {amount:0, currency: state.homeCurrency}, departure: flightFormData.departure || new Date().toISOString()}]}));
                                    setNewFlightModal(false);
                                }
                            }}>Save</Button>
                       </div>
                  </div>
             </Modal>
        )}
    </div>
  );
};

const AgencyDashboard: React.FC<{
    savedTrips: AppState[];
    agencyProfile: AgencyProfile;
    setAgencyProfile: (p: AgencyProfile) => void;
    onOpenTrip: (id: string) => void;
    onCreateTrip: (clientName: string, tripName: string) => void;
    onDeleteTrip: (id: string) => void;
    onUpdateStatus: (id: string, status: TripStatus) => void;
    onUpdateTripData: (tripId: string, updates: Partial<AppState>) => void;
    onImportTrip: (trip: AppState) => void;
}> = ({ savedTrips, agencyProfile, setAgencyProfile, onOpenTrip, onCreateTrip, onDeleteTrip, onUpdateStatus, onUpdateTripData, onImportTrip }) => {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [newTripOpen, setNewTripOpen] = useState(false);
    const [crmModalOpen, setCrmModalOpen] = useState(false);
    const [crmActiveTrip, setCrmActiveTrip] = useState<AppState | null>(null);
    const [newTripData, setNewTripData] = useState({client:'', trip:''});
    const [profileData, setProfileData] = useState(agencyProfile);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
    const [newTaskText, setNewTaskText] = useState('');
    const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredTrips = useMemo(() => {
        if(!searchQuery) return savedTrips;
        const q = searchQuery.toLowerCase();
        return savedTrips.filter(t => t.clientName.toLowerCase().includes(q) || t.tripName.toLowerCase().includes(q));
    }, [savedTrips, searchQuery]);

    const pipelineValue = useMemo(() => {
        return filteredTrips
            .filter(t => ['drafting', 'proposal', 'booked'].includes(t.status))
            .reduce((sum, t) => sum + (t.totalBudget || 0), 0);
    }, [filteredTrips]);

    const upcomingTrips = useMemo(() => {
        return savedTrips
            .map(t => {
                const dates = [
                    ...t.stops.map(s => s.start),
                    ...t.flights.map(f => f.departure)
                ].filter(Boolean).sort();
                return { ...t, startDate: dates[0] };
            })
            .filter(t => t.startDate && new Date(t.startDate) >= new Date()) // Future only
            .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
            .slice(0, 3);
    }, [savedTrips]);

    const totalTrips = filteredTrips.length;
    
    const stages: {id: TripStatus, label: string, color: string}[] = [
        { id: 'inquiry', label: 'Inquiry', color: 'bg-slate-100 text-slate-600' },
        { id: 'drafting', label: 'Drafting', color: 'bg-blue-50 text-blue-600' },
        { id: 'proposal', label: 'Proposal', color: 'bg-indigo-50 text-indigo-600' },
        { id: 'booked', label: 'Booked', color: 'bg-emerald-50 text-emerald-600' },
        { id: 'completed', label: 'Completed', color: 'bg-slate-100 text-slate-400' }
    ];

    const calculateColumnTotal = (status: TripStatus) => {
        return filteredTrips
            .filter(t => t.status === status)
            .reduce((sum, t) => sum + (t.totalBudget || 0), 0);
    };

    const handleGenerateTasks = async () => {
        if (!crmActiveTrip) return;
        setIsGeneratingTasks(true);
        const stopsDesc = crmActiveTrip.stops.map(s => s.place).join(', ');
        const desc = `${crmActiveTrip.tripName} for ${crmActiveTrip.clientName}. Stops: ${stopsDesc}`;
        
        const tasks = await suggestAgencyTasks(crmActiveTrip.status, desc);
        const newTasks: AgencyTask[] = tasks.map(t => ({ id: crypto.randomUUID(), text: t, completed: false }));
        
        onUpdateTripData(crmActiveTrip.id, { agencyTasks: [...(crmActiveTrip.agencyTasks || []), ...newTasks] });
        setCrmActiveTrip(prev => prev ? ({...prev, agencyTasks: [...(prev.agencyTasks || []), ...newTasks]}) : null);
        setIsGeneratingTasks(false);
    };
    
    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const result = ev.target?.result;
                if (typeof result === 'string') {
                    const data = JSON.parse(result);
                    if(data.id && data.clientName) {
                        onImportTrip(data);
                    } else {
                        alert("Invalid trip file structure");
                    }
                }
            } catch(e) { alert("Error reading file"); }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset
    };

    const KanbanBoard = () => {
        const handleDragStart = (e: React.DragEvent, id: string) => {
            e.dataTransfer.setData('tripId', id);
        };
        
        const handleDrop = (e: React.DragEvent, status: TripStatus) => {
            const id = e.dataTransfer.getData('tripId');
            if (id) onUpdateStatus(id, status);
        };

        return (
            <div className="flex gap-4 overflow-x-auto pb-6 h-[500px] md:h-[calc(100vh-300px)] items-start snap-x snap-mandatory px-2 md:px-0">
                {stages.map(stage => {
                    const trips = filteredTrips.filter(t => (t.status || 'inquiry') === stage.id);
                    const colTotal = calculateColumnTotal(stage.id);
                    
                    return (
                        <div 
                            key={stage.id} 
                            className="min-w-[85vw] md:min-w-[280px] md:w-72 flex-shrink-0 bg-slate-100/50 rounded-2xl p-3 flex flex-col h-full border border-slate-200/50 snap-center"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, stage.id)}
                        >
                            <div className="flex justify-between items-center mb-1 px-2">
                                <h3 className="font-bold text-slate-700 text-sm">{stage.label}</h3>
                                <span className="text-xs font-bold bg-white text-slate-500 px-2 py-0.5 rounded-full shadow-sm">{trips.length}</span>
                            </div>
                            <div className="px-2 mb-3">
                                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pipeline Value</div>
                                <div className="text-sm font-bold text-slate-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(colTotal)}</div>
                            </div>
                            <div className="space-y-3 overflow-y-auto flex-1 custom-scrollbar pr-1">
                                {trips.map(trip => {
                                    const tasks = trip.agencyTasks || [];
                                    const completedTasks = tasks.filter(t => t.completed).length;
                                    
                                    return (
                                    <div 
                                        key={trip.id} 
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, trip.id)}
                                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md cursor-pointer group relative active:rotate-1 transition-transform" 
                                        onClick={() => onOpenTrip(trip.id)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">{trip.clientName.charAt(0)}</div>
                                            <div className="flex gap-1 relative z-10">
                                                <button 
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onClick={(e) => { e.stopPropagation(); setCrmActiveTrip(trip); setCrmModalOpen(true); }} 
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
                                                    title="CRM Notes"
                                                >
                                                    <ClipboardList className="w-4 h-4"/>
                                                </button>
                                                <button 
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    onClick={(e) => { 
                                                        e.preventDefault();
                                                        e.stopPropagation(); 
                                                        if(window.confirm(`Delete trip for ${trip.clientName}?`)) onDeleteTrip(trip.id); 
                                                    }} 
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                                                    title="Delete Trip"
                                                >
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="font-bold text-slate-800 text-sm mb-0.5 line-clamp-2">{trip.tripName}</div>
                                        <div className="text-xs text-slate-500 mb-3">{trip.clientName}</div>
                                        
                                        {tasks.length > 0 && (
                                            <div className="mb-3">
                                                <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                                                    <span>Tasks</span>
                                                    <span>{completedTasks}/{tasks.length}</span>
                                                </div>
                                                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500" style={{ width: `${(completedTasks/tasks.length)*100}%` }}></div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                                            <div className="text-[10px] font-bold text-slate-400">{new Date(trip.lastModified).toLocaleDateString()}</div>
                                            <select 
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border-none outline-none cursor-pointer ${stage.color}`}
                                                value={trip.status || 'inquiry'}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => onUpdateStatus(trip.id, e.target.value as TripStatus)}
                                            >
                                                {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )})}
                                {trips.length === 0 && <div className="text-center py-6 text-slate-400 text-xs italic border border-dashed border-slate-300 rounded-xl">Drop items here</div>}
                            </div>
                        </div>
                    )
                })}
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-8">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                     <div className="flex items-center gap-4">
                         <div className="w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center text-white text-3xl font-bold" style={{backgroundColor: agencyProfile.primaryColor}}>
                            {agencyProfile.logoUrl ? <img src={agencyProfile.logoUrl} className="w-full h-full object-cover rounded-2xl"/> : agencyProfile.name.charAt(0)}
                         </div>
                         <div>
                             <h1 className="text-3xl font-black text-slate-800 tracking-tight">{agencyProfile.name}</h1>
                             <p className="text-slate-500 font-medium">Agent Dashboard</p>
                         </div>
                     </div>
                     <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                         <div className="relative w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                            <input 
                                className="pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64 shadow-sm"
                                placeholder="Search clients or trips..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                         </div>
                         <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                             <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm flex-shrink-0">
                                 <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-5 h-5"/></button>
                                 <button onClick={() => setViewMode('kanban')} className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Columns className="w-5 h-5"/></button>
                             </div>
                             <button onClick={() => setSettingsOpen(true)} className="px-3 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:border-indigo-200 hover:text-indigo-600 shadow-sm transition-all flex items-center gap-2 flex-shrink-0"><Settings className="w-5 h-5"/></button>
                             
                             <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".json" />
                             <button type="button" onClick={() => fileInputRef.current?.click()} className="px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center gap-2 flex-shrink-0 whitespace-nowrap"><Upload className="w-5 h-5"/> Open Trip File</button>
                             
                             <button onClick={() => setNewTripOpen(true)} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center gap-2 flex-shrink-0 whitespace-nowrap"><Plus className="w-5 h-5"/> New Trip</button>
                         </div>
                     </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Briefcase className="w-6 h-6"/></div>
                        <div><div className="text-slate-400 font-bold uppercase text-xs tracking-wider">Active Trips</div><div className="text-3xl font-black text-slate-800">{totalTrips}</div></div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><TrendingUp className="w-6 h-6"/></div>
                        <div><div className="text-slate-400 font-bold uppercase text-xs tracking-wider">Pipeline Value</div><div className="text-2xl font-black text-slate-800">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(pipelineValue)}</div></div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-3">
                             <Calendar className="w-4 h-4 text-orange-500"/>
                             <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Upcoming Departures</div>
                        </div>
                        <div className="space-y-2">
                            {upcomingTrips.length === 0 ? <div className="text-xs text-slate-400 italic">No upcoming trips.</div> : upcomingTrips.map(t => (
                                <div key={t.id} className="flex items-center gap-3 text-sm">
                                    <div className="font-bold text-slate-700 w-12 flex-shrink-0">{new Date(t.startDate!).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                                    <div className="flex-1 truncate text-slate-600 font-medium">{t.clientName}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-3xl shadow-lg shadow-indigo-200 text-white flex items-center gap-4">
                         <div className="p-3 bg-white/20 rounded-2xl"><CheckCircle2 className="w-6 h-6 text-white"/></div>
                         <div><div className="text-indigo-100 font-bold uppercase text-xs tracking-wider">Agency Status</div><div className="text-2xl font-bold">Active</div></div>
                    </div>
                </div>

                {viewMode === 'kanban' ? <KanbanBoard /> : (
                    <>
                        <h2 className="text-xl font-bold text-slate-800 mb-6">All Trips</h2>
                        {filteredTrips.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                <Users className="w-16 h-16 text-slate-200 mx-auto mb-4"/>
                                <h3 className="text-xl font-bold text-slate-700">{searchQuery ? 'No trips found' : 'No trips yet'}</h3>
                                <p className="text-slate-400 mb-6">{searchQuery ? 'Try a different search term.' : 'Create your first client itinerary to get started.'}</p>
                                {!searchQuery && <Button onClick={() => setNewTripOpen(true)}>Create Trip</Button>}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredTrips.map(trip => (
                                    <div key={trip.id} onClick={() => onOpenTrip(trip.id)} className="group bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 flex gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); if(confirm(`Are you sure you want to delete the trip for ${trip.clientName}?`)) onDeleteTrip(trip.id); }} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                        <div className="mb-4">
                                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-lg mb-4">
                                                {trip.clientName.charAt(0)}
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800 mb-1">{trip.tripName}</h3>
                                            <p className="text-slate-500 font-medium text-sm flex items-center gap-2"><Users className="w-4 h-4"/> {trip.clientName}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mt-6 pt-6 border-t border-slate-50">
                                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {trip.stops.length} Stops</span>
                                            <span className={`px-2 py-0.5 rounded-full ${stages.find(s=>s.id===(trip.status||'inquiry'))?.color}`}>{stages.find(s=>s.id===(trip.status||'inquiry'))?.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {crmModalOpen && crmActiveTrip && (
                <Modal title="CRM Quick View" onClose={() => setCrmModalOpen(false)}>
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h4 className="font-bold text-slate-800">{crmActiveTrip.clientName}</h4>
                            <p className="text-sm text-slate-500">{crmActiveTrip.tripName}</p>
                            <div className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Status: {crmActiveTrip.status}</div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-slate-400"/>
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Internal Notes (Private)</span>
                            </div>
                            <textarea 
                                className="w-full p-3 border border-slate-200 rounded-xl bg-white text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                                placeholder="Add private notes about this client or trip..."
                                value={crmActiveTrip.agencyNotes || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCrmActiveTrip({...crmActiveTrip, agencyNotes: val});
                                    onUpdateTripData(crmActiveTrip.id, { agencyNotes: val });
                                }}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-slate-400"/>
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Admin Checklist</span>
                                </div>
                                <button 
                                    onClick={handleGenerateTasks}
                                    disabled={isGeneratingTasks}
                                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
                                >
                                    {isGeneratingTasks ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                                    AI Suggest Tasks
                                </button>
                            </div>
                            
                            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto custom-scrollbar">
                                {(crmActiveTrip.agencyTasks || []).map((task) => (
                                    <div key={task.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg group">
                                        <input 
                                            type="checkbox" 
                                            checked={task.completed}
                                            onChange={() => {
                                                const updatedTasks = (crmActiveTrip.agencyTasks || []).map(t => t.id === task.id ? {...t, completed: !t.completed} : t);
                                                setCrmActiveTrip({...crmActiveTrip, agencyTasks: updatedTasks});
                                                onUpdateTripData(crmActiveTrip.id, { agencyTasks: updatedTasks });
                                            }}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <span className={`text-sm flex-1 ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.text}</span>
                                        <button 
                                            onClick={() => {
                                                const updatedTasks = (crmActiveTrip.agencyTasks || []).filter(t => t.id !== task.id);
                                                setCrmActiveTrip({...crmActiveTrip, agencyTasks: updatedTasks});
                                                onUpdateTripData(crmActiveTrip.id, { agencyTasks: updatedTasks });
                                            }}
                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4"/>
                                        </button>
                                    </div>
                                ))}
                                {(crmActiveTrip.agencyTasks || []).length === 0 && <div className="text-slate-400 text-sm italic py-2 text-center">No tasks yet.</div>}
                            </div>

                            <div className="flex gap-2">
                                <input 
                                    className="flex-1 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                    placeholder="Add new task..."
                                    value={newTaskText}
                                    onChange={e => setNewTaskText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && newTaskText.trim()) {
                                            const newTask: AgencyTask = { id: crypto.randomUUID(), text: newTaskText, completed: false };
                                            const updatedTasks = [...(crmActiveTrip.agencyTasks || []), newTask];
                                            setCrmActiveTrip({...crmActiveTrip, agencyTasks: updatedTasks});
                                            onUpdateTripData(crmActiveTrip.id, { agencyTasks: updatedTasks });
                                            setNewTaskText('');
                                        }
                                    }}
                                />
                                <button 
                                    onClick={() => {
                                        if (newTaskText.trim()) {
                                            const newTask: AgencyTask = { id: crypto.randomUUID(), text: newTaskText, completed: false };
                                            const updatedTasks = [...(crmActiveTrip.agencyTasks || []), newTask];
                                            setCrmActiveTrip({...crmActiveTrip, agencyTasks: updatedTasks});
                                            onUpdateTripData(crmActiveTrip.id, { agencyTasks: updatedTasks });
                                            setNewTaskText('');
                                        }
                                    }}
                                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    <Plus className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-100">
                             <Button onClick={() => setCrmModalOpen(false)}>Done</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {settingsOpen && (
                <Modal title="Agency Settings" onClose={() => setSettingsOpen(false)}>
                    <div className="space-y-4">
                        <InputGroup label="Agency Name"><input className="w-full p-3 border rounded-xl" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} /></InputGroup>
                        <InputGroup label="Logo URL"><input className="w-full p-3 border rounded-xl" value={profileData.logoUrl} onChange={e => setProfileData({...profileData, logoUrl: e.target.value})} placeholder="https://..." /></InputGroup>
                        <InputGroup label="Primary Color"><input type="color" className="w-full h-12 rounded-xl cursor-pointer" value={profileData.primaryColor} onChange={e => setProfileData({...profileData, primaryColor: e.target.value})} /></InputGroup>
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Email"><input className="w-full p-3 border rounded-xl" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} /></InputGroup>
                            <InputGroup label="Phone"><input className="w-full p-3 border rounded-xl" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} /></InputGroup>
                        </div>
                        <div className="pt-4 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>Cancel</Button>
                            <Button onClick={() => { setAgencyProfile(profileData); setSettingsOpen(false); }}>Save Profile</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {newTripOpen && (
                <Modal title="New Client Trip" onClose={() => setNewTripOpen(false)}>
                    <div className="space-y-4">
                        <InputGroup label="Client Name"><input autoFocus className="w-full p-3 border rounded-xl" value={newTripData.client} onChange={e => setNewTripData({...newTripData, client: e.target.value})} placeholder="e.g. John & Sarah Smith" /></InputGroup>
                        <InputGroup label="Trip Name"><input className="w-full p-3 border rounded-xl" value={newTripData.trip} onChange={e => setNewTripData({...newTripData, trip: e.target.value})} placeholder="e.g. Italian Summer Honeymoon" /></InputGroup>
                        <div className="pt-4 flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setNewTripOpen(false)}>Cancel</Button>
                            <Button onClick={() => { if(newTripData.client && newTripData.trip) { onCreateTrip(newTripData.client, newTripData.trip); setNewTripOpen(false); setNewTripData({client:'', trip:''}); } }}>Start Planning</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- Main App Entry ---

const App: React.FC = () => {
    // Persistent State for Agency Data
    const [savedTrips, setSavedTrips] = useState<AppState[]>(() => {
        const saved = localStorage.getItem('tf_trips');
        return saved ? JSON.parse(saved) : [];
    });

    const [agencyProfile, setAgencyProfile] = useState<AgencyProfile>(() => {
        const saved = localStorage.getItem('tf_agency');
        return saved ? JSON.parse(saved) : DEFAULT_AGENCY;
    });

    const [currentTripId, setCurrentTripId] = useState<string | null>(null);
    const [isClientMode, setIsClientMode] = useState(false);
    const [hideCosts, setHideCosts] = useState(false);

    const activeTrip = useMemo(() => savedTrips.find(t => t.id === currentTripId), [savedTrips, currentTripId]);

    useEffect(() => { localStorage.setItem('tf_trips', JSON.stringify(savedTrips)); }, [savedTrips]);
    useEffect(() => { localStorage.setItem('tf_agency', JSON.stringify(agencyProfile)); }, [agencyProfile]);

    const handleUpdateActiveTrip = (updater: (prev: AppState) => AppState) => {
        if (!currentTripId) return;
        setSavedTrips(prev => prev.map(t => t.id === currentTripId ? { ...updater(t), lastModified: Date.now() } : t));
    };

    const handleCreateTrip = (clientName: string, tripName: string) => {
        const newTrip: AppState = {
            id: crypto.randomUUID(),
            clientName,
            tripName,
            lastModified: Date.now(),
            status: 'inquiry',
            step: 1,
            destinations: [],
            stops: [],
            flights: [],
            dayPlans: {},
            packingList: [],
            expenses: [],
            links: [],
            homeCurrency: 'EUR',
            totalBudget: 0,
            travelers: 1,
            paidItemIds: []
        };
        setSavedTrips(prev => [...prev, newTrip]);
        setCurrentTripId(newTrip.id);
        setIsClientMode(false); 
    };

    const handleDeleteTrip = (id: string) => {
        setSavedTrips(prev => prev.filter(t => t.id !== id));
        if (currentTripId === id) setCurrentTripId(null);
    };

    const handleUpdateStatus = (id: string, status: TripStatus) => {
        setSavedTrips(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    };

    const handleUpdateTripData = (id: string, updates: Partial<AppState>) => {
        setSavedTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates, lastModified: Date.now() } : t));
    };
    
    const handleImportTrip = (trip: AppState) => {
        // Check for duplicates before setting state to avoid side effects in updater
        const existingIndex = savedTrips.findIndex(t => t.id === trip.id);
        
        if (existingIndex >= 0) {
            if (window.confirm(`Trip "${trip.tripName}" already exists. Do you want to overwrite it?`)) {
                 setSavedTrips(prev => prev.map(t => t.id === trip.id ? { ...trip, lastModified: Date.now() } : t));
            } else if (window.confirm("Import as a new copy?")) {
                 const newTrip = { ...trip, id: crypto.randomUUID(), tripName: `${trip.tripName} (Copy)`, lastModified: Date.now() };
                 setSavedTrips(prev => [...prev, newTrip]);
            }
        } else {
            setSavedTrips(prev => [...prev, { ...trip, lastModified: Date.now() }]);
        }
    };

    if (!currentTripId || !activeTrip) {
        return (
            <AgencyDashboard 
                savedTrips={savedTrips} 
                agencyProfile={agencyProfile}
                setAgencyProfile={setAgencyProfile}
                onOpenTrip={setCurrentTripId}
                onCreateTrip={handleCreateTrip}
                onDeleteTrip={handleDeleteTrip}
                onUpdateStatus={handleUpdateStatus}
                onUpdateTripData={handleUpdateTripData}
                onImportTrip={handleImportTrip}
            />
        );
    }

    const setStateProxy = handleUpdateActiveTrip as unknown as React.Dispatch<React.SetStateAction<AppState>>;

    return (
        <div className="w-full h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
            {activeTrip.step === 1 && (
                <StepDestinations 
                    selected={activeTrip.destinations}
                    onSelect={(d) => setStateProxy(s => ({...s, destinations: [...s.destinations, d]}))}
                    onRemove={(id) => setStateProxy(s => ({...s, destinations: s.destinations.filter(d => d.id !== id)}))}
                    onNext={() => setStateProxy(s => ({...s, step: 2}))}
                />
            )}
            {activeTrip.step === 2 && (
                <StepRoute 
                    state={activeTrip} 
                    setState={setStateProxy} 
                    onNext={() => setStateProxy(s => ({...s, step: 3}))} 
                    onBack={() => setStateProxy(s => ({...s, step: 1}))}
                />
            )}
            {activeTrip.step === 3 && (
                <StepDashboard 
                    state={activeTrip} 
                    setState={setStateProxy} 
                    onBack={() => setCurrentTripId(null)} 
                    onPreviousStep={() => setStateProxy(s => ({...s, step: 2}))} 
                    agencyProfile={agencyProfile}
                    isClientMode={isClientMode}
                    toggleClientMode={() => setIsClientMode(!isClientMode)}
                    hideCosts={hideCosts}
                    setHideCosts={setHideCosts}
                />
            )}
        </div>
    );
};

export default App;
