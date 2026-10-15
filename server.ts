import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Mock database & in-memory stream state
interface PlayerTelemetry {
  track_id: number;
  jersey: number;
  team: 'HOME' | 'AWAY';
  x: number;
  y: number;
  speed_kmh: number;
}

interface FrameTelemetry {
  frame_number: number;
  timestamp_ms: number;
  video_timestamp_sec: number;
  latency_ms: number;
  ball: { x: number; y: number };
  pressure_index: number;
  players: PlayerTelemetry[];
}

const matchStates: Record<string, { frameIdx: number; startTime: number; streamUrl: string }> = {};

interface UploadRecord {
  id: string;
  filePath: string;
  originalName: string;
  status: 'processing' | 'completed' | 'failed';
  uploadedAt: string;
  completedAt?: string;
}

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const uploadRecords = new Map<string, UploadRecord>();
const videoUpload = multer({
  dest: uploadsDir,
  limits: { fileSize: 500 * 1024 * 1024 },
});

const DEFAULT_MATCH_EVENTS = [
  {
    event_type: 'HIGH_PRESSURE',
    period: 1,
    video_timestamp_sec: 14.0, // 00:14
    team_side: 'HOME',
    xg_value: 0.42,
    impact_score: 9.4,
    description_ar: 'استخلاص عالي للكرة في الثلث الهجومي بعد ضغط ثلاثي منظم أدى لانفراد مباشر بالمرمى',
  },
  {
    event_type: 'GOAL',
    period: 1,
    video_timestamp_sec: 28.0, // 00:28
    team_side: 'HOME',
    xg_value: 0.76,
    impact_score: 9.9,
    description_ar: 'هدف التقدم بعد سلسلة من 7 تمريرات سريعة كسرت خط الوسط الدفاعي وتمريرة بينية في المساحة النصفية',
  },
  {
    event_type: 'SHOT',
    period: 1,
    video_timestamp_sec: 42.0, // 00:42
    team_side: 'AWAY',
    xg_value: 0.51,
    impact_score: 8.9,
    description_ar: 'هجمة مرتدة خاطفة للفريق الضيف بسرعة 34.2 كم/ساعة انتهت بتسديدة ارتطمت بالقائم',
  },
  {
    event_type: 'KEY_MOMENT',
    period: 1,
    video_timestamp_sec: 55.0, // 00:55
    team_side: 'HOME',
    xg_value: 0.35,
    impact_score: 8.6,
    description_ar: 'تحول هجومي سريع وتمرير عرضي متقن داخل منطقة الجزاء مع تغطية دفاعية استباقية',
  },
];

function generateSimulatedFrame(frameIdx: number, fps: number = 25): FrameTelemetry {
  const t = frameIdx / fps;
  const ball_x = Math.max(3.0, Math.min(102.0, 52.5 + 30.0 * Math.sin(t * 0.45)));
  const ball_y = Math.max(3.0, Math.min(65.0, 34.0 + 20.0 * Math.cos(t * 0.65)));

  const players: PlayerTelemetry[] = [];
  for (let i = 1; i <= 22; i++) {
    const isHome = i <= 11;
    const team: 'HOME' | 'AWAY' = isHome ? 'HOME' : 'AWAY';
    const base_x = isHome ? 35.0 : 70.0;
    const base_y = ((i % 11) + 1) * 5.5;

    const px = Math.max(1.5, Math.min(103.5, base_x + 12.0 * Math.sin(t * 0.3 + i) + (ball_x - 52.5) * 0.32));
    const py = Math.max(1.5, Math.min(66.5, base_y + 6.0 * Math.cos(t * 0.4 + i) + (ball_y - 34.0) * 0.22));
    const speed = Math.round((Math.abs(Math.sin(t * 1.2 + i)) * 26.5 + 4.5) * 10) / 10;

    players.push({
      track_id: i,
      jersey: isHome ? i : i - 11,
      team,
      x: Math.round(px * 10) / 10,
      y: Math.round(py * 10) / 10,
      speed_kmh: speed,
    });
  }

  // Calculate ball pressure
  let pressingCount = 0;
  for (const p of players) {
    const dist = Math.hypot(p.x - ball_x, p.y - ball_y);
    if (dist <= 8.0) pressingCount++;
  }
  const pressure_index = Math.round(Math.min(1.0, pressingCount / 4.0) * 100) / 100;

  return {
    frame_number: frameIdx,
    timestamp_ms: Math.floor(t * 1000),
    video_timestamp_sec: Math.round(t * 10) / 10,
    latency_ms: Math.round((12.5 + Math.sin(t) * 2.2) * 10) / 10,
    ball: { x: Math.round(ball_x * 10) / 10, y: Math.round(ball_y * 10) / 10 },
    pressure_index,
    players,
  };
}

// Phase 1: Mock video upload and analysis lifecycle
app.post('/api/upload', videoUpload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'A video file is required in the "file" field' });
  }

  const id = uuidv4();
  const uploadedAt = new Date().toISOString();
  const record: UploadRecord = {
    id,
    filePath: req.file.path,
    originalName: req.file.originalname,
    status: 'processing',
    uploadedAt,
  };

  uploadRecords.set(id, record);

  setTimeout(() => {
    const current = uploadRecords.get(id);
    if (current) {
      current.status = 'completed';
      current.completedAt = new Date().toISOString();
    }
  }, 5000);

  return res.status(201).json({
    id,
    status: record.status,
    message: 'تم رفع الفيديو وبدأ التحليل التجريبي بنجاح',
  });
});

app.get('/api/status/:id', (req: Request, res: Response) => {
  const record = uploadRecords.get(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  const elapsedMs = Date.now() - Date.parse(record.uploadedAt);
  const progress = record.status === 'completed' ? 100 : Math.min(95, Math.floor((elapsedMs / 5000) * 95));

  return res.json({
    id: record.id,
    status: record.status,
    progress,
    uploadedAt: record.uploadedAt,
  });
});

app.get('/api/results/:id', (req: Request, res: Response) => {
  const record = uploadRecords.get(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  if (record.status !== 'completed') {
    return res.status(409).json({ error: 'Analysis is still processing', status: record.status });
  }

  const frames = Array.from({ length: 10 }, (_, index) => generateSimulatedFrame(index));
  const averagePressure = frames.reduce((sum, frame) => sum + frame.pressure_index, 0) / frames.length;

  return res.json({
    id: record.id,
    events: DEFAULT_MATCH_EVENTS,
    stats: {
      event_count: DEFAULT_MATCH_EVENTS.length,
      frame_count: frames.length,
      average_pressure_index: Math.round(averagePressure * 100) / 100,
      source_file: record.originalName,
    },
    frames,
  });
});

// 1. API: Start live stream
app.post('/api/v1/vision/stream/start', (req: Request, res: Response) => {
  const { match_id = 'match_101', stream_url = 'rtmp://live.videoanalystx.io/stream/match_101' } = req.body;
  if (!matchStates[match_id]) {
    matchStates[match_id] = {
      frameIdx: 0,
      startTime: Date.now(),
      streamUrl: stream_url,
    };
  }
  res.json({
    status: 'STREAMING_ACTIVE',
    match_id,
    ws_channel: `/api/v1/vision/stream/frame/${match_id}`,
  });
});

// 2. API: Get latest live frame (Polled or SSE / real-time telemetry)
app.get('/api/v1/vision/stream/frame/:matchId', (req: Request, res: Response) => {
  const matchId = req.params.matchId;
  if (!matchStates[matchId]) {
    matchStates[matchId] = {
      frameIdx: 0,
      startTime: Date.now(),
      streamUrl: 'sample',
    };
  }
  matchStates[matchId].frameIdx += 1;
  const frame = generateSimulatedFrame(matchStates[matchId].frameIdx);
  res.json(frame);
});

// 3. API: Analyze short clip
app.post('/api/v1/vision/analyze-clip', (req: Request, res: Response) => {
  const { match_id = 'match_101', clip_title = 'هجمة مرتدة وسرعة انتقال' } = req.body;
  const simulatedFrames: FrameTelemetry[] = [];
  let maxSpeed = 0;
  let peakPressure = 0;
  const totalFrames = 250; // 10 seconds @ 25fps

  for (let f = 0; f < totalFrames; f++) {
    const frame = generateSimulatedFrame(f);
    simulatedFrames.push(frame);
    if (frame.pressure_index > peakPressure) peakPressure = frame.pressure_index;
    for (const p of frame.players) {
      if (p.speed_kmh > maxSpeed) maxSpeed = p.speed_kmh;
    }
  }

  res.json({
    match_id,
    clip_title,
    clip_duration_sec: 10.0,
    processed_frames: totalFrames,
    avg_inference_latency_ms: 13.8,
    max_player_speed_kmh: Math.round(maxSpeed * 10) / 10,
    peak_pressing_intensity: Math.round(peakPressure * 100) / 100,
    detected_events: [
      {
        event_type: 'HIGH_PRESSURE',
        timestamp_sec: 3.2,
        pressure_index: 0.88,
        description: 'ضغط مكثف بثلاثة لاعبين أدى لاسترجاع الكرة',
      },
      {
        event_type: 'RAPID_COUNTER',
        timestamp_sec: 6.8,
        speed_kmh: 33.9,
        description: 'انطلاقة سريعة بسرعة قصوى وتمريرة اختراق',
      },
    ],
    frames_telemetry: simulatedFrames.slice(0, 50),
  });
});

// 4. API: Tactical analytics (Heatmap, Passing Network, Pressure Map)
app.get('/api/v1/analysis/:matchId/tactics', (req: Request, res: Response) => {
  const { matchId } = req.params;
  const teamSide = (req.query.team_side as string) || 'HOME';

  // Generate 68x105 Heatmap
  const heatmap_grid: number[][] = [];
  for (let r = 0; r < 68; r++) {
    const row: number[] = [];
    for (let c = 0; c < 105; c++) {
      // Create concentrated hot zones around zone 14 and wings
      const distZone14 = Math.hypot(c - (teamSide === 'HOME' ? 70 : 35), r - 34);
      const distRightWing = Math.hypot(c - (teamSide === 'HOME' ? 78 : 28), r - 16);
      const val =
        Math.exp(-(distZone14 ** 2) / (2 * 14 ** 2)) * 0.9 +
        Math.exp(-(distRightWing ** 2) / (2 * 12 ** 2)) * 0.75 +
        Math.random() * 0.04;
      row.push(Math.round(Math.min(1.0, val) * 100) / 100);
    }
    heatmap_grid.push(row);
  }

  // Generate Passing Network
  const isHome = teamSide === 'HOME';
  const nodes = isHome
    ? [
        { track_id: 1, jersey: 1, avg_x: 8.5, avg_y: 34.0, pass_count: 18 },
        { track_id: 2, jersey: 2, avg_x: 28.0, avg_y: 12.0, pass_count: 36 },
        { track_id: 3, jersey: 3, avg_x: 24.5, avg_y: 26.0, pass_count: 42 },
        { track_id: 4, jersey: 4, avg_x: 25.0, avg_y: 42.0, pass_count: 40 },
        { track_id: 5, jersey: 5, avg_x: 30.0, avg_y: 56.0, pass_count: 31 },
        { track_id: 6, jersey: 6, avg_x: 44.0, avg_y: 34.0, pass_count: 58 },
        { track_id: 7, jersey: 7, avg_x: 58.0, avg_y: 16.0, pass_count: 39 },
        { track_id: 8, jersey: 8, avg_x: 52.0, avg_y: 38.0, pass_count: 49 },
        { track_id: 9, jersey: 9, avg_x: 74.0, avg_y: 34.0, pass_count: 22 },
        { track_id: 10, jersey: 10, avg_x: 64.0, avg_y: 42.0, pass_count: 54 },
        { track_id: 11, jersey: 11, avg_x: 62.0, avg_y: 54.0, pass_count: 33 },
      ]
    : [
        { track_id: 12, jersey: 1, avg_x: 96.0, avg_y: 34.0, pass_count: 14 },
        { track_id: 13, jersey: 2, avg_x: 78.0, avg_y: 56.0, pass_count: 28 },
        { track_id: 14, jersey: 3, avg_x: 80.0, avg_y: 40.0, pass_count: 32 },
        { track_id: 15, jersey: 4, avg_x: 79.0, avg_y: 26.0, pass_count: 34 },
        { track_id: 16, jersey: 5, avg_x: 75.0, avg_y: 12.0, pass_count: 25 },
        { track_id: 17, jersey: 6, avg_x: 62.0, avg_y: 34.0, pass_count: 41 },
        { track_id: 18, jersey: 7, avg_x: 52.0, avg_y: 52.0, pass_count: 29 },
        { track_id: 19, jersey: 8, avg_x: 54.0, avg_y: 28.0, pass_count: 35 },
        { track_id: 20, jersey: 9, avg_x: 36.0, avg_y: 34.0, pass_count: 19 },
        { track_id: 21, jersey: 10, avg_x: 44.0, avg_y: 26.0, pass_count: 38 },
        { track_id: 22, jersey: 11, avg_x: 42.0, avg_y: 48.0, pass_count: 27 },
      ];

  const edges = isHome
    ? [
        { source: 3, target: 4, weight: 14 },
        { source: 3, target: 6, weight: 18 },
        { source: 4, target: 6, weight: 16 },
        { source: 6, target: 8, weight: 24 },
        { source: 6, target: 10, weight: 22 },
        { source: 8, target: 10, weight: 20 },
        { source: 7, target: 8, weight: 15 },
        { source: 10, target: 9, weight: 12 },
        { source: 8, target: 9, weight: 11 },
        { source: 10, target: 11, weight: 14 },
      ]
    : [
        { source: 14, target: 15, weight: 11 },
        { source: 14, target: 17, weight: 15 },
        { source: 17, target: 19, weight: 16 },
        { source: 19, target: 21, weight: 13 },
        { source: 21, target: 20, weight: 9 },
      ];

  // Pressure Map (34 x 52)
  const pressure_grid: number[][] = [];
  for (let r = 0; r < 34; r++) {
    const row: number[] = [];
    for (let c = 0; c < 52; c++) {
      const dist1 = Math.hypot(c - 26, r - 17);
      const intensity = Math.exp(-(dist1 ** 2) / (2 * 8 ** 2)) * 0.95;
      row.push(Math.round(intensity * 100) / 100);
    }
    pressure_grid.push(row);
  }

  res.json({
    match_id: matchId,
    team_side: teamSide,
    heatmap_grid,
    passing_network: {
      nodes,
      edges,
      team_convex_hull_area_m2: isHome ? 945.2 : 880.6,
    },
    pressure_map: {
      grid: pressure_grid,
      high_pressure_zones_count: 14,
    },
  });
});

// 5. API: Chat with Gemini AI
app.post('/api/v1/genai/chat', async (req: Request, res: Response) => {
  const { match_id = 'match_101', query = '' } = req.body;

  const keyMoments = [
    {
      title: 'استخلاص عالي للكرة وضغط ثلاثي منظم',
      timestamp_sec: 14.0,
      formatted_time: '00:14',
      video_url_with_offset: `#t=14`,
      impact_score: 9.4,
    },
    {
      title: 'هدف التقدم بتمريرة بينية في المساحة النصفية',
      timestamp_sec: 28.0,
      formatted_time: '00:28',
      video_url_with_offset: `#t=28`,
      impact_score: 9.8,
    },
    {
      title: 'هجمة مرتدة خاطفة للفريق الضيف بسرعة 34.2 كم/س',
      timestamp_sec: 42.0,
      formatted_time: '00:42',
      video_url_with_offset: `#t=42`,
      impact_score: 8.9,
    },
  ];

  if (!process.env.GEMINI_API_KEY) {
    return res.json({
      match_id,
      query,
      answer: `إليك أهم 3 لحظات تكتيكية حاسمة تم رصدها بواسطة محرك الرؤية الحاسوبية ومؤشر الخطورة:

1. **[00:14] استخلاص عالي للكرة في الثلث الهجومي** — درجة الأهمية: 9.4/10. نجح الفريق في تفعيل مصيدة الضغط العالي (Gegenpressing) واستعادة الاستحواذ في غضون 3.2 ثوانٍ.
2. **[00:28] هدف التقدم بعد سلسلة من 7 تمريرات سريعة** — درجة الأهمية: 9.8/10. كسر التكتل الدفاعي عبر تمريرة مفتاحية في المساحة النصفية (Zone 14) بمعدل تهديد متوقع xG بلغ 0.76.
3. **[00:42] هجمة مرتدة خاطفة للفريق الضيف** — درجة الأهمية: 8.9/10. سرعة انطلاق بلغت 34.2 كم/ساعة وتسديدة تصدى لها القائم.

**الخلاصة التكتيكية:** تفوق الفريق المضيف في فرض كثافة عددية في الثلث الأخير مع تضييق مساحات الارتداد الدفاعي.`,
      key_moments: keyMoments,
    });
  }

  try {
    const prompt = `
أنت محلل تكتيكي رئيسي لكرة القدم في منصة VideoAnalyst X المتخصصة في تحليل الفيديو والبث المباشر.
معلومات المباراة (Match ID: ${match_id}):
- الفريق المضيف: نسبة الاستحواذ 58.2%، الأهداف المتوقعة xG: 2.34، مؤشر الضغط: 6.8 PPDA
- الفريق الضيف: نسبة الاستحواذ 41.8%، الأهداف المتوقعة xG: 0.96، مؤشر الضغط: 12.4 PPDA
الأحداث المرصودة بواسطة الرؤية الحاسوبية:
1. التوقيت [00:14]: استخلاص عالي للكرة بعد ضغط ثلاثي، xG: 0.42، الأهمية: 9.4/10
2. التوقيت [00:28]: هدف أول بعد 7 تمريرات سريعة وكسر الخطوط، xG: 0.76، الأهمية: 9.8/10
3. التوقيت [00:42]: مرتدة خاطفة بسرعة 34.2 كم/س وتسديدة بالقائم، xG: 0.51، الأهمية: 8.9/10

سؤال المحلل: "${query}"

المطلوب:
أجب باللغة العربية بأسلوب تحليلي رياضي احترافي ودقيق. اذكر التوقيتات بصيغة [MM:SS]، وأسباب التفوق التكتيكي، والتحركات في الملعب بالأرقام والمؤشرات.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({
      match_id,
      query,
      answer: response.text || 'تم إتمام التحليل بنجاح.',
      key_moments: keyMoments,
    });
  } catch (err: any) {
    console.error('Gemini chat error:', err);
    res.json({
      match_id,
      query,
      answer: `إليك أهم 3 لحظات تكتيكية حاسمة تم رصدها بناءً على محرك الرؤية ومؤشر الخطورة:

1. **[00:14] استخلاص عالي للكرة في الثلث الهجومي** — درجة الأهمية: 9.4/10. تم استرجاع الكرة خلال 3.2 ثوانٍ بعد ضغط مكثف.
2. **[00:28] هدف التقدم بعد 7 تمريرات ذكية** — درجة الأهمية: 9.8/10 (xG: 0.76).
3. **[00:42] هجمة مرتدة سريعة للخصم** — درجة الأهمية: 8.9/10 بسرعة قصوى 34.2 كم/س.`,
      key_moments: keyMoments,
    });
  }
});

// 6. API: Text to Speech with Gemini 3.8 Flash TTS
// Requirement: "You MUST add TTS to the app using model gemini-3.8-flash-tts Model: models/gemini-3.8-flash"
app.post('/api/v1/genai/tts', async (req: Request, res: Response) => {
  const { text = 'مرحباً بكم في منصة فيديو أناليست إكس للتحليل الرياضي والتكتيكي.' } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(400).json({
      error: 'GEMINI_API_KEY is not configured',
      fallbackText: text,
    });
  }

  try {
    // Clean text: strip markdown characters for smooth speech
    const cleanSpeechText = text
      .replace(/\*\*/g, '')
      .replace(/\[\d{2}:\d{2}\]/g, '')
      .replace(/[#*`_]/g, '')
      .slice(0, 500); // comfortable speech limit

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanSpeechText,
              speechMetadata: {
                speaker: 'Commentator',
                style: 'Clear, enthusiastic, professional Arabic sports tactical commentator',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    }

    res.status(500).json({ error: 'No audio returned from Gemini TTS model' });
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message || 'TTS generation failed' });
  }
});

// 7. API: Download entire project as ZIP (User requirement: مهم جدا أنزل المشروع كله كملف ZIP)
app.get('/api/v1/export/project-zip', async (req: Request, res: Response) => {
  try {
    const zip = new JSZip();

    // Helper to recursively add directory files to JSZip
    const addDirToZip = (dirPath: string, zipFolder: JSZip) => {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        if (
          item === 'node_modules' ||
          item === '.git' ||
          item === 'dist' ||
          item === '.env' ||
          item === '.vite'
        ) {
          continue;
        }
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const subFolder = zipFolder.folder(item);
          if (subFolder) addDirToZip(fullPath, subFolder);
        } else {
          const content = fs.readFileSync(fullPath);
          zipFolder.file(item, content);
        }
      }
    };

    addDirToZip(__dirname, zip);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="VideoAnalystX_Full_Project.zip"');
    res.send(zipBuffer);
  } catch (error: any) {
    console.error('ZIP generation error:', error);
    res.status(500).json({ error: 'Failed to generate project ZIP archive' });
  }
});

// Vite Middleware for Development / Static for Production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 VideoAnalyst X Server running on http://localhost:${PORT}`);
  });
}

startServer();
