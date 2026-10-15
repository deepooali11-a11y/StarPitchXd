import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Send,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Loader2,
  Bot,
  User,
  Clock,
  Flame,
} from 'lucide-react';

export interface KeyMoment {
  title: string;
  timestamp_sec: number;
  formatted_time: string;
  video_url_with_offset: string;
  impact_score: number;
}

interface Message {
  sender: 'USER' | 'AI';
  text: string;
  moments?: KeyMoment[];
  audioBase64?: string;
}

interface AIChatSidebarProps {
  matchId: string;
  onSeekVideo: (seconds: number) => void;
}

export const AIChatSidebar: React.FC<AIChatSidebarProps> = ({ matchId, onSeekVideo }) => {
  const [query, setQuery] = useState('إيه أهم 3 لحظات في الشوط الأول؟');
  const [loading, setLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'AI',
      text: `مرحباً بك في المساعد التكتيكي الذكي (VideoAnalyst X - Gemini AI). 
أنا جاهز لتحليل كل لقطة، ومناقشة قرارات التمركز، وشبكات التمرير، ومؤشرات الضغط وسرعات اللاعبين.`,
      moments: [
        {
          title: 'استخلاص عالي للكرة في الثلث الهجومي',
          timestamp_sec: 14.0,
          formatted_time: '00:14',
          video_url_with_offset: '#t=14',
          impact_score: 9.4,
        },
        {
          title: 'هدف التقدم بكسر خطوط الوسط',
          timestamp_sec: 28.0,
          formatted_time: '00:28',
          video_url_with_offset: '#t=28',
          impact_score: 9.8,
        },
        {
          title: 'هجمة مرتدة خاطفة للخصم بسرعة 34.2 كم/س',
          timestamp_sec: 42.0,
          formatted_time: '00:42',
          video_url_with_offset: '#t=42',
          impact_score: 8.9,
        },
      ],
    },
  ]);

  const quickQuestions = [
    'إيه أهم 3 لحظات في الشوط الأول؟',
    'كيف كان تمركز خط الدفاع في الهجمات المرتدة؟',
    'ما هي فاعلية الضغط العالي (Gegenpressing) اليوم؟',
    'حلل لي شبكة التمرير ومثلثات الاستحواذ',
  ];

  const sendMessage = async (overrideQuery?: string) => {
    const textToSend = overrideQuery || query;
    if (!textToSend.trim() || loading) return;

    setMessages((prev) => [...prev, { sender: 'USER', text: textToSend }]);
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/genai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, query: textToSend }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: 'AI',
          text: data.answer,
          moments: data.key_moments,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'AI',
          text: 'حدث خطأ في الاتصال بخدمة الذكاء الاصطناعي. تم تفعيل التحليل الاحتياطي.',
          moments: [
            {
              title: 'هدف التقدم وتفكيك الدفاع',
              timestamp_sec: 28.0,
              formatted_time: '00:28',
              video_url_with_offset: '#t=28',
              impact_score: 9.8,
            },
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Convert Text to Speech using Gemini 3.8 Flash TTS
  const handlePlayTTS = async (text: string, msgIndex: number) => {
    // If already playing this message, stop it
    if (playingAudioIndex === msgIndex && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioIndex(null);
      return;
    }

    setTtsLoading(true);
    setPlayingAudioIndex(msgIndex);

    try {
      const res = await fetch('/api/v1/genai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      if (data.audioBase64) {
        const audioSrc = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
        if (!audioRef.current) {
          audioRef.current = new Audio(audioSrc);
        } else {
          audioRef.current.src = audioSrc;
        }
        audioRef.current.onended = () => setPlayingAudioIndex(null);
        await audioRef.current.play();
      } else {
        // Fallback to browser SpeechSynthesis if API key not present or error
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text.replace(/[*#]/g, '').slice(0, 200));
          utterance.lang = 'ar-SA';
          utterance.onend = () => setPlayingAudioIndex(null);
          window.speechSynthesis.speak(utterance);
        } else {
          setPlayingAudioIndex(null);
        }
      }
    } catch (err) {
      console.error('TTS playback error:', err);
      // Fallback to browser voice
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text.replace(/[*#]/g, '').slice(0, 200));
        utterance.lang = 'ar-SA';
        utterance.onend = () => setPlayingAudioIndex(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setPlayingAudioIndex(null);
      }
    } finally {
      setTtsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
              المساعد التكتيكي (Gemini AI)
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                gemini-3.8-flash-tts
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">تحليل فوري ونطق صوتي للأحداث</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          جاهز
        </span>
      </div>

      {/* Quick Prompts Carousel */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none text-xs">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => sendMessage(q)}
            className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 pl-1 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3.5 rounded-xl text-xs leading-relaxed transition ${
              m.sender === 'USER'
                ? 'bg-sky-600/90 text-white self-end border border-sky-500/40 mr-6'
                : 'bg-slate-950/80 text-slate-200 border border-slate-800/80 ml-2'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5 text-[11px] opacity-75">
              <span className="flex items-center gap-1 font-semibold">
                {m.sender === 'USER' ? (
                  <>
                    <User className="w-3.5 h-3.5" /> أنت
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5 text-sky-400" /> المحلل التكتيكي
                  </>
                )}
              </span>

              {m.sender === 'AI' && (
                <button
                  onClick={() => handlePlayTTS(m.text, i)}
                  title="استماع صوتي عبر Gemini TTS"
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 transition"
                >
                  {playingAudioIndex === i ? (
                    <>
                      <VolumeX className="w-3 h-3 text-rose-400" />
                      <span className="text-[10px] text-rose-400">إيقاف</span>
                    </>
                  ) : ttsLoading && playingAudioIndex === i ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                      <span className="text-[10px]">توليد...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px]">استمع (Gemini TTS)</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="whitespace-pre-line text-[12px]">{m.text}</p>

            {/* Clickable Moment Pills with video seek */}
            {m.moments && m.moments.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-slate-800/80 pt-2.5">
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 mb-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>اللقطات الحاسمة (اضغط للانتقال بالفيديو فوراً):</span>
                </div>
                {m.moments.map((mom, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSeekVideo(mom.timestamp_sec)}
                    className="w-full text-right flex items-center justify-between bg-slate-900 hover:bg-sky-950/60 hover:border-sky-700/60 px-3 py-2 rounded-lg border border-slate-800 text-xs transition group"
                  >
                    <span className="flex items-center gap-1.5 text-sky-400 font-mono font-bold text-[11px]">
                      <Play className="w-3 h-3 fill-sky-400 group-hover:scale-110 transition" />
                      [{mom.formatted_time}]
                    </span>
                    <span className="truncate mx-2 flex-1 text-slate-300 text-[11px]">
                      {mom.title}
                    </span>
                    <span className="text-emerald-400 font-semibold text-[10px] bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                      {mom.impact_score}/10
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 bg-slate-950/60 rounded-xl text-xs text-slate-400 border border-slate-800 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            <span>جاري تحليل البيانات واستنباط المؤشرات التكتيكية...</span>
          </div>
        )}
      </div>

      {/* Input Field */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="اسأل المحلل الذكي عن أي لقطة أو خطة..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !query.trim()}
          className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-lg shadow-sky-600/20"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>إرسال</span>
        </button>
      </div>
    </div>
  );
};
