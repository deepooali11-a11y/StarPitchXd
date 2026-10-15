import React, { useState } from 'react';
import {
  Download,
  FolderArchive,
  CheckCircle2,
  FileCode2,
  Server,
  Database,
  Cpu,
  Bot,
  X,
  Loader2,
} from 'lucide-react';

interface ProjectZipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectZipModal: React.FC<ProjectZipModalProps> = ({ isOpen, onClose }) => {
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const filesTree = [
    { name: 'docker-compose.yml', icon: Server, desc: 'ملف تشغيل كافة الخدمات (Postgres, Redis, Vision, Analysis, GenAI)' },
    { name: 'database/init.sql', icon: Database, desc: 'مخطط قاعدة بيانات PostgreSQL مع فهارس GIN لتتبع الإحداثيات' },
    { name: 'services/vision_service/', icon: Cpu, desc: 'كود Python للرؤية الحاسوبية (YOLOv8, ByteTrack, Homography 105x68)' },
    { name: 'services/analysis_service/', icon: FileCode2, desc: 'محرك التحليل التكتيكي الرياضي (NumPy, SciPy, Gaussian Heatmap)' },
    { name: 'services/genai_service/', icon: Bot, desc: 'وكيل المساعد الذكي ومولد تقارير PDF المعتمد على Gemini API' },
    { name: 'server.ts & package.json', icon: Server, desc: 'خادم Node.js / Express المتكامل مع دعم WebSocket و GenAI' },
    { name: 'src/ (Frontend React)', icon: FileCode2, desc: 'الواجهة الأمامية التفاعلية بالكامل مع Canvas و Recharts' },
  ];

  const triggerDownload = () => {
    setDownloading(true);
    // Direct link to backend ZIP generation endpoint
    window.location.href = '/api/v1/export/project-zip';
    setTimeout(() => {
      setDownloading(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-right">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-2 text-sky-400">
          <FolderArchive className="w-5 h-5" />
          <h2 className="text-lg font-bold text-white">تحميل المشروع كاملاً (Full Project ZIP)</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          يحتوي الملف المضغوط على الهيكلية البرمجية الكاملة لمنصة VideoAnalyst X الجاهزة للتشغيل بضغطة زر.
        </p>

        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto pr-1">
          {filesTree.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs"
              >
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="font-mono font-bold text-slate-200 block text-[11px] direction-ltr text-right">
                    {item.name}
                  </span>
                  <span className="text-[11px] text-slate-400">{item.desc}</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            إلغاء
          </button>
          <button
            disabled={downloading}
            onClick={triggerDownload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition shadow-lg shadow-sky-600/30 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري تجميع الملفات في أرشيف ZIP...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>تحميل المشروع الآن (VideoAnalystX.zip)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
