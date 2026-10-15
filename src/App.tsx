import React, { useEffect, useRef, useState } from 'react';
import {
  LivePitchCanvas,
  PlayerNode,
  PassingNetworkData,
} from './components/LivePitchCanvas.tsx';
import { TacticalCharts, TelemetryPoint } from './components/TacticalCharts.tsx';
import { AIChatSidebar } from './components/AIChatSidebar.tsx';
import { ShortClipModal } from './components/ShortClipModal.tsx';
import { PdfReportModal } from './components/PdfReportModal.tsx';
import { ProjectZipModal } from './components/ProjectZipModal.tsx';
import { VideoUploadModal } from './components/VideoUploadModal';
import type { AnalysisResults } from './lib/types';
import {
  Radio,
  Download,
  FileText,
  Film,
  Zap,
  Activity,
  Gauge,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  Layers,
  Sparkles,
  Shield,
  Crosshair,
  Upload as UploadIcon,
} from 'lucide-react';

export default function App() {
  const matchId = 'match_101';
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [streamUrl, setStreamUrl] = useState('rtmp://live.videoanalystx.io/stream/match_101');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);

  const [overlayMode, setOverlayMode] = useState<
    'LIVE_TRACKING' | 'HEATMAP' | 'PASSING_NETWORK' | 'PRESSURE_MAP'
  >('LIVE_TRACKING');
  const [teamSide, setTeamSide] = useState<'HOME' | 'AWAY'>('HOME');

  const [players, setPlayers] = useState<PlayerNode[]>([]);
  const [ball, setBall] = useState<{ x: number; y: number }>({ x: 52.5, y: 34.0 });
  const [latencyMs, setLatencyMs] = useState<number>(13.8);
  const [pressureIndex, setPressureIndex] = useState<number>(0.64);
  const [chartData, setChartData] = useState<TelemetryPoint[]>([]);

  const [heatmapGrid, setHeatmapGrid] = useState<number[][]>([]);
  const [passingNetwork, setPassingNetwork] = useState<PassingNetworkData | undefined>();
  const [pressureGrid, setPressureGrid] = useState<number[][]>([]);
  const [clipResult, setClipResult] = useState<any>(null);

  // Modals state
  const [isClipModalOpen, setIsClipModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadResults, setUploadResults] = useState<AnalysisResults | null>(null);

  // Poll live telemetry from server or simulated stream
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const fetchLiveFrame = async () => {
      try {
        const res = await fetch(`/api/v1/vision/stream/frame/${matchId}`);
        if (!res.ok) return;
        const data = await res.json();
        setPlayers(data.players || []);
        setBall(data.ball || { x: 52.5, y: 34.0 });
        setLatencyMs(data.latency_ms || 14.0);
        setPressureIndex(data.pressure_index || 0.6);

        const maxSpd = Math.max(0, ...(data.players || []).map((p: PlayerNode) => p.speed_kmh));
        setChartData((prev) => [
          ...prev.slice(-20),
          {
            time: `${data.video_timestamp_sec}s`,
            pressure: Math.round((data.pressure_index || 0) * 100),
            maxSpeed: maxSpd,
          },
        ]);
      } catch (e) {
        console.error('Frame fetch error:', e);
      }
    };

    fetchLiveFrame();
    timer = setInterval(fetchLiveFrame, 120); // ~8 Hz updates for silky smooth radar

    return () => clearInterval(timer);
  }, [matchId]);

  // Load tactical matrices when switching modes
  const handleModeChange = async (
    mode: 'LIVE_TRACKING' | 'HEATMAP' | 'PASSING_NETWORK' | 'PRESSURE_MAP'
  ) => {
    setOverlayMode(mode);
    if (mode === 'LIVE_TRACKING') return;

    try {
      const res = await fetch(`/api/v1/analysis/${matchId}/tactics?team_side=${teamSide}`);
      const data = await res.json();
      setHeatmapGrid(data.heatmap_grid || []);
      setPassingNetwork(data.passing_network);
      setPressureGrid(data.pressure_map?.grid || []);
    } catch (err) {
      console.error('Tactical load error:', err);
    }
  };

  // Video Seek Trigger from Chat or Timeline
  const handleSeekVideo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatVideoTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-6 font-['Cairo',sans-serif]">
      {/* Top Header Navbar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-emerald-500 p-0.5 shadow-lg shadow-sky-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Crosshair className="w-5 h-5 text-sky-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white flex items-center">
                VideoAnalyst <span className="text-sky-400 ml-1">X</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                v1.0 Pro
              </span>
            </div>
            <p className="text-xs text-slate-400">
              منصة التحليل التكتيكي للبث الرياضي المباشر ونماذج الذكاء الاصطناعي (YOLOv8 + Gemini)
            </p>
          </div>
        </div>

        {/* Live Status Indicators & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs shadow-inner">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">زمن الاستجابة:</span>
            <span className="text-emerald-400 font-bold font-mono">{latencyMs} ms</span>
          </div>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
          >
            <UploadIcon size={16} />
            رفع فيديو
          </button>

          <button
            onClick={() => setIsClipModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Film className="w-3.5 h-3.5" />
            <span>تحليل مقطع قصير (10s)</span>
          </button>

          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>تصدير تقرير المباراة (PDF)</span>
          </button>

          <button
            onClick={() => setIsZipModalOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition shadow-xl shadow-sky-600/30 ring-1 ring-white/20 cursor-pointer"
          >
            <Download className="w-4 h-4 animate-bounce" />
            <span>تحميل المشروع بالكامل (ZIP)</span>
          </button>
        </div>
      </header>

      {/* Real-time KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 my-4 text-xs">
        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">معدل الإطارات (FPS)</span>
            <strong className="text-sm font-mono text-white">25.0 FPS</strong>
          </div>
          <Gauge className="w-4 h-4 text-sky-400" />
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">تتبع الهويات (ByteTrack)</span>
            <strong className="text-sm font-mono text-emerald-400">22 لاعب + كرة</strong>
          </div>
          <Crosshair className="w-4 h-4 text-emerald-400" />
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">الاستحواذ اللحظي</span>
            <strong className="text-sm font-mono text-red-400">58.2% <span className="text-slate-500 text-xs">| 41.8%</span></strong>
          </div>
          <Activity className="w-4 h-4 text-red-400" />
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">مؤشر الضغط (Pressure)</span>
            <strong className="text-sm font-mono text-amber-400">{Math.round(pressureIndex * 100)}%</strong>
          </div>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">الأهداف المتوقعة (xG)</span>
            <strong className="text-sm font-mono text-white">2.34 <span className="text-slate-500 text-xs">vs 0.96</span></strong>
          </div>
          <Shield className="w-4 h-4 text-indigo-400" />
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">المساحة التكتيكية (Hull)</span>
            <strong className="text-sm font-mono text-sky-400">945.2 م²</strong>
          </div>
          <Layers className="w-4 h-4 text-sky-400" />
        </div>
      </div>

      {/* Main Grid: Visuals & Radar (8 cols) + AI Chatbot (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Section: Video, Tactical Pitch, Charts */}
        <div className="lg:col-span-8 space-y-5">
          {/* Stream Connection & Overlay Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 shadow-md">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              </div>
              <input
                type="text"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="أدخل رابط بث RTMP أو HLS..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={() => handleModeChange(overlayMode)}
                className="bg-sky-600 hover:bg-sky-500 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white transition cursor-pointer"
              >
                تحديث
              </button>
            </div>

            {/* Tactical Layers Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'LIVE_TRACKING', label: 'التتبع الحي (25 FPS)' },
                { id: 'HEATMAP', label: 'الخريطة الحرارية' },
                { id: 'PASSING_NETWORK', label: 'شبكة التمرير' },
                { id: 'PRESSURE_MAP', label: 'خريطة الضغط' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => handleModeChange(btn.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    overlayMode === btn.id
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Video Player & 2D Tactical Pitch Canvas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Video Player Container */}
            <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2 px-1 text-xs text-slate-400 border-b border-slate-800/80 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  <span className="font-semibold text-slate-200">بث الفيديو المباشر (Camera Feed)</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {formatVideoTime(videoCurrentTime)} / 01:30
                </span>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-black aspect-[16/10] flex items-center justify-center group">
                <video
                  ref={videoRef}
                  loop
                  muted={isMuted}
                  playsInline
                  autoPlay
                  onTimeUpdate={() => {
                    if (videoRef.current) setVideoCurrentTime(videoRef.current.currentTime);
                  }}
                  className="w-full h-full object-cover"
                  src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
                  poster="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80"
                />

                {/* Tactical Bounding Box Overlay Simulation */}
                <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                      YOLOv8 Detection: Active (98.4%)
                    </span>
                    <span className="bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-sky-400 border border-sky-500/30">
                      Homography: Calibrated
                    </span>
                  </div>

                  {/* Simulated bounding boxes over action */}
                  <div className="absolute top-1/3 left-1/4 border-2 border-red-500 bg-red-500/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-red-200">
                    #10 HOME (28.4 km/h)
                  </div>
                  <div className="absolute top-1/2 left-1/2 border-2 border-yellow-400 bg-yellow-400/20 rounded-full w-4 h-4 -translate-x-2 -translate-y-2 animate-ping"></div>
                </div>

                {/* Floating Video Controls */}
                <div className="absolute bottom-2 left-2 right-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleVideoPlayback}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-200 transition"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleSeekVideo(0)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-200 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-200 transition"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">1080p @ 60FPS</span>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Supervision Annotator v0.24
                </span>
                <span className="font-mono text-slate-500">RANSAC Matrix Threshold: 5.0</span>
              </div>
            </div>

            {/* Live 2D Tactical Pitch Canvas */}
            <LivePitchCanvas
              players={players}
              ball={ball}
              overlayMode={overlayMode}
              heatmapGrid={heatmapGrid}
              passingNetwork={passingNetwork}
              pressureGrid={pressureGrid}
            />
          </div>

          {/* Short Clip Analysis Result Banner (if run) */}
          {clipResult && (
            <div className="bg-indigo-950/40 border border-indigo-700/60 rounded-2xl p-4 text-xs flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{clipResult.clip_title}</h4>
                  <p className="text-[11px] text-indigo-300">
                    تمت معالجة {clipResult.processed_frames} إطار خلال {clipResult.clip_duration_sec} ثانية بمتوسط {clipResult.avg_inference_latency_ms}ms
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <div className="text-center">
                  <span className="text-[11px] text-slate-400 block">أقصى سرعة</span>
                  <strong className="text-sm font-mono text-emerald-400">{clipResult.max_player_speed_kmh} كم/س</strong>
                </div>
                <div className="text-center">
                  <span className="text-[11px] text-slate-400 block">ذروة الضغط</span>
                  <strong className="text-sm font-mono text-amber-400">
                    {Math.round(clipResult.peak_pressing_intensity * 100)}%
                  </strong>
                </div>
                <button
                  onClick={() => setClipResult(null)}
                  className="px-3 py-1 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 transition"
                >
                  إخفاء
                </button>
              </div>
            </div>
          )}

          {/* Recharts Analytics Component */}
          <TacticalCharts data={chartData} />
        </div>

        {/* Right Section: Gemini Tactical AI Assistant with TTS */}
        <div className="lg:col-span-4 h-[720px] lg:h-auto min-h-[640px]">
          <AIChatSidebar matchId={matchId} onSeekVideo={handleSeekVideo} />
        </div>
      </div>

      {/* Modals */}
      <ShortClipModal
        isOpen={isClipModalOpen}
        onClose={() => setIsClipModalOpen(false)}
        onClipAnalyzed={(res) => setClipResult(res)}
      />

      <PdfReportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        matchId={matchId}
      />

      <ProjectZipModal
        isOpen={isZipModalOpen}
        onClose={() => setIsZipModalOpen(false)}
      />
      <VideoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onResultsReady={(results) => {
          setUploadResults(results);
          setClipResult(results as any);
        }}
      />
    </main>
  );
}
