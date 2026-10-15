import React, { useState } from 'react';
import {
  Upload,
  Film,
  Zap,
  Activity,
  Gauge,
  CheckCircle2,
  X,
  PlayCircle,
  Loader2,
} from 'lucide-react';

interface ClipResult {
  match_id: string;
  clip_title: string;
  clip_duration_sec: number;
  processed_frames: number;
  avg_inference_latency_ms: number;
  max_player_speed_kmh: number;
  peak_pressing_intensity: number;
  detected_events: {
    event_type: string;
    timestamp_sec: number;
    pressure_index?: number;
    speed_kmh?: number;
    description: string;
  }[];
}

interface ShortClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClipAnalyzed: (result: ClipResult) => void;
}

export const ShortClipModal: React.FC<ShortClipModalProps> = ({
  isOpen,
  onClose,
  onClipAnalyzed,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('counter');
  const [customFileName, setCustomFileName] = useState<string>('');

  if (!isOpen) return null;

  const presets = [
    {
      id: 'counter',
      title: 'هجمة مرتدة وسرعة انتقال (Transition 34.2 km/h)',
      desc: 'تحليل سرعة الارتداد العكسي وكسر الخطوط الدفاعية خلال 10 ثوانٍ',
      tag: 'High Velocity',
    },
    {
      id: 'press',
      title: 'ضغط عالي واستخلاص الكرة (Gegenpress Trap)',
      desc: 'حساب كثافة اللاعبين حول الكرة ونصف قطر التأثير المكاني',
      tag: 'Pressure Index: 92%',
    },
    {
      id: 'box_cross',
      title: 'عرضية واختراق العمق الدفاعي (Zone 14 Penetration)',
      desc: 'تحليل الأهداف المتوقعة xG وحساب زوايا التمرير لداخل الصندوق',
      tag: 'xG: 0.74',
    },
  ];

  const runAnalysis = async (title: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/v1/vision/analyze-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: 'match_101', clip_title: title }),
      });
      const data: ClipResult = await res.json();
      onClipAnalyzed(data);
      onClose();
    } catch (err) {
      console.error('Clip analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCustomFileName(file.name);
      runAnalysis(file.name);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative text-right">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-2 text-indigo-400">
          <Film className="w-5 h-5" />
          <h2 className="text-lg font-bold text-white">
            تحليل المقاطع القصيرة المركّز (Intensive Short Clip AI)
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          ارفع مقطع فيديو قصير (10 ثوانٍ) أو اختر من المقاطع الاختبارية لحساب السرعات اللحظية، وتتبع اللاعبين، ومؤشرات الضغط عبر محرك YOLOv8 + ByteTrack.
        </p>

        {/* Upload Zone */}
        <div className="border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-xl p-5 mb-5 text-center bg-slate-950/60 transition group cursor-pointer relative">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Upload className="w-8 h-8 mx-auto mb-2 text-indigo-400 group-hover:scale-110 transition" />
          <p className="text-sm font-semibold text-slate-200 mb-1">
            {customFileName ? customFileName : 'اضغط لاختيار فيديو أو اسحب الملف هنا'}
          </p>
          <p className="text-[11px] text-slate-500">يدعم صيغ MP4, WebM, MOV حتى 50MB</p>
        </div>

        {/* Presets List */}
        <h3 className="text-xs font-bold text-slate-300 mb-2">أو اختر مقطعاً تكتيكياً جاهزاً للمحاكاة:</h3>
        <div className="space-y-2 mb-6">
          {presets.map((preset) => (
            <div
              key={preset.id}
              onClick={() => setSelectedPreset(preset.id)}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                selectedPreset === preset.id
                  ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 font-bold mb-0.5">
                  <PlayCircle className="w-4 h-4 text-indigo-400" />
                  <span>{preset.title}</span>
                </div>
                <p className="text-[11px] text-slate-400">{preset.desc}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 font-mono">
                {preset.tag}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            إلغاء
          </button>
          <button
            disabled={analyzing}
            onClick={() => {
              const selected = presets.find((p) => p.id === selectedPreset);
              runAnalysis(selected ? selected.title : 'تحليل تكتيكي مخصص');
            }}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري معالجة الإطارات واستخراج المسارات...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>بدء التحليل المكثف (25 FPS)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
