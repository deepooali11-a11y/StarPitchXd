import React, { useState } from 'react';
import {
  FileText,
  Download,
  X,
  CheckCircle2,
  TrendingUp,
  Shield,
  Zap,
  Target,
  Sparkles,
  Loader2,
} from 'lucide-react';
import jsPDF from 'jspdf';

interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  onClose,
  matchId,
}) => {
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const matchStats = {
    title: 'Match Analysis — Home vs Away (Tactical Review)',
    date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
    homePossession: 58.2,
    awayPossession: 41.8,
    homeXg: 2.34,
    awayXg: 0.96,
    homePpda: '6.8 PPDA',
    awayPpda: '12.4 PPDA',
    homeHullM2: 945.2,
    awayHullM2: 880.6,
    homeMaxSpeed: '35.1 km/h',
    awayMaxSpeed: '34.2 km/h',
  };

  const keyMoments = [
    { time: '14:20', team: 'HOME', type: 'HIGH_PRESSURE', xg: '0.42', impact: '9.4/10', desc: 'استخلاص الكرة في الثلث الأخير وضغط عكسي ثلاثي' },
    { time: '28:15', team: 'HOME', type: 'GOAL', xg: '0.76', impact: '9.9/10', desc: 'هدف التقدم بعد 7 تمريرات سريعة واختراق المساحة النصفية' },
    { time: '41:10', team: 'AWAY', type: 'SHOT', xg: '0.51', impact: '8.9/10', desc: 'هجمة مرتدة سريعة وتسديدة بالعارضة' },
  ];

  const handleDownloadPdf = () => {
    setDownloading(true);
    try {
      const doc = new jsPDF();

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('VideoAnalyst X - Tactical Match Report', 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Match ID: ${matchId} | Generated: ${new Date().toISOString()}`, 14, 28);

      // Section 1: Executive Metrics
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(14);
      doc.text('1. Executive Tactical Metrics Comparison', 14, 48);

      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      let yPos = 58;
      const rows = [
        ['Metric', 'Home Team', 'Away Team'],
        ['Possession (%)', `${matchStats.homePossession}%`, `${matchStats.awayPossession}%`],
        ['Expected Goals (xG)', `${matchStats.homeXg}`, `${matchStats.awayXg}`],
        ['Pressing Index (PPDA)', matchStats.homePpda, matchStats.awayPpda],
        ['Team Tactical Hull Area', `${matchStats.homeHullM2} m2`, `${matchStats.awayHullM2} m2`],
        ['Max Sprint Speed', matchStats.homeMaxSpeed, matchStats.awayMaxSpeed],
      ];

      rows.forEach((r, idx) => {
        if (idx === 0) {
          doc.setFillColor(241, 245, 249);
          doc.rect(14, yPos - 5, 182, 8, 'F');
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        doc.text(r[0], 18, yPos);
        doc.text(r[1], 100, yPos);
        doc.text(r[2], 150, yPos);
        yPos += 8;
      });

      // Section 2: AI Detected Key Moments
      yPos += 8;
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Computer Vision & AI Key Moments', 14, yPos);

      yPos += 10;
      keyMoments.forEach((m) => {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, yPos - 4, 182, 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`[${m.time}] ${m.type} - Impact: ${m.impact}`, 18, yPos + 1);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(`Team: ${m.team} | xG: ${m.xg} | ${m.desc}`, 18, yPos + 6);
        yPos += 15;
      });

      // Section 3: Gemini AI Synthesis
      yPos += 6;
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Gemini AI Tactical Synthesis', 14, yPos);

      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const summaryText =
        'The Home Team successfully established sustained field dominance via rapid triangular passing circuits in Zone 14. High Gegenpress intensity generated ball recovery within 3.2 seconds on average. The defensive unit maintained an optimal Convex Hull expansion area of 945.2 m2, shutting down central transition corridors.';
      const splitText = doc.splitTextToSize(summaryText, 180);
      doc.text(splitText, 14, yPos);

      doc.save(`VideoAnalystX_Report_${matchId}.pdf`);
    } catch (e) {
      console.error('PDF generation error:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative text-right max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-2 text-emerald-400">
          <FileText className="w-5 h-5" />
          <h2 className="text-lg font-bold text-white">التقرير التكتيكي الشامل للمباراة (PDF Report)</h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          تقرير احترافي مولّد تلقائياً من خوارزميات الرؤية الحاسوبية ونموذج Gemini للذكاء الاصطناعي يتضمن كافة الإحصائيات المتقدمة.
        </p>

        {/* Report Preview Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mb-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">{matchStats.title}</h3>
              <p className="text-[11px] text-slate-500">{matchStats.date} | معرف المباراة: {matchId}</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
              مكتمل
            </span>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[11px] mb-1">الاستحواذ</span>
              <div className="flex justify-between font-mono font-bold text-sm">
                <span className="text-red-400">{matchStats.homePossession}%</span>
                <span className="text-slate-600">:</span>
                <span className="text-blue-400">{matchStats.awayPossession}%</span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[11px] mb-1">الأهداف المتوقعة (xG)</span>
              <div className="flex justify-between font-mono font-bold text-sm">
                <span className="text-red-400">{matchStats.homeXg}</span>
                <span className="text-slate-600">:</span>
                <span className="text-blue-400">{matchStats.awayXg}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[11px] mb-1">مؤشر الضغط (PPDA)</span>
              <div className="flex justify-between font-mono font-bold text-sm">
                <span className="text-red-400">{matchStats.homePpda}</span>
                <span className="text-slate-600">:</span>
                <span className="text-blue-400">{matchStats.awayPpda}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[11px] mb-1">المساحة التكتيكية (م²)</span>
              <div className="flex justify-between font-mono font-bold text-sm">
                <span className="text-red-400">{matchStats.homeHullM2}</span>
                <span className="text-slate-600">:</span>
                <span className="text-blue-400">{matchStats.awayHullM2}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 col-span-2">
              <span className="text-slate-400 block text-[11px] mb-1">أقصى سرعة مسجلة</span>
              <div className="flex justify-between font-mono font-bold text-sm">
                <span className="text-red-400">{matchStats.homeMaxSpeed}</span>
                <span className="text-slate-600">:</span>
                <span className="text-blue-400">{matchStats.awayMaxSpeed}</span>
              </div>
            </div>
          </div>

          {/* Key Moments Table */}
          <div className="border-t border-slate-800/80 pt-3">
            <h4 className="text-xs font-bold text-slate-300 mb-2">أبرز اللحظات التكتيكية المرصودة:</h4>
            <div className="space-y-1.5 text-xs">
              {keyMoments.map((km, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-sky-400 font-mono font-bold">[{km.time}]</span>
                  <span className="text-slate-200 truncate flex-1 mx-3">{km.desc}</span>
                  <span className="text-emerald-400 font-mono text-[11px]">{km.impact}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Synthesis */}
          <div className="bg-sky-950/20 border border-sky-900/40 rounded-lg p-3 text-xs text-sky-200 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-sky-400 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>خلاصة الذكاء الاصطناعي (Gemini Synthesis):</span>
            </div>
            تفوق الفريق المضيف في كسر خطوط الضغط والانتشار العريض في الثلث الهجومي مما أدى إلى خلق 4 فرص كبرى بمعدل xG مرتفع، مع سيطرة واضحة على منطقة الارتكاز (Zone 14).
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            إغلاق
          </button>
          <button
            disabled={downloading}
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-600/30 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري بناء ملف PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>تحميل تقرير PDF الآن</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
