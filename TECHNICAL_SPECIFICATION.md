# VideoAnalyst X — Technical Specification & Architecture Document (v1.0)

## 1. نظرة عامة على النظام (System Overview)
منصة **VideoAnalyst X** هي منظومة موزعة عالية الأداء (High-Performance Distributed System) مصممة لتحليل البث الرياضي المباشر (RTMP/HLS) والمقاطع المسجلة في الوقت الفعلي بزمن استجابة أقل من 800 مللي ثانية (Sub-Second Latency). تعتمد المنصة على معمارية الخدمات المصغرة (Microservices) المدعومة بمعالجات الرسوميات (NVIDIA GPUs) لاستخراج الإحداثيات المكانية والزمانية (Spatio-Temporal Tracking) وتحويلها إلى رؤى تكتيكية متقدمة وتقارير تفاعلية عبر نماذج الذكاء الاصطناعي التوليدي (Google Gemini).

---

## 2. هيكلية المشروع (Project Architecture)

```text
videoanalyst-x/
├── docker-compose.yml
├── database/
│   └── init.sql
├── services/
│   ├── vision_service/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── homography.py
│   │   ├── tracker.py
│   │   └── main.py
│   ├── analysis_service/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── tactical_engine.py
│   │   └── main.py
│   └── genai_service/
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── gemini_agent.py
│       ├── report_generator.py
│       └── main.py
├── server.ts
├── package.json
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    └── components/
        ├── LivePitchCanvas.tsx
        ├── TacticalCharts.tsx
        ├── AIChatSidebar.tsx
        ├── ShortClipModal.tsx
        ├── PdfReportModal.tsx
        └── ProjectZipModal.tsx
```

---

## 3. حزمة التقنيات (Tech Stack)

- **Frontend:** React 19 + TypeScript + Tailwind CSS + Recharts + Lucide Icons.
- **Backend API:** Node.js + Express.js + Vite Middlewares.
- **Computer Vision:** Python 3.11 + Ultralytics YOLOv8 + ByteTrack + Supervision + OpenCV + Scikit-Learn KMeans.
- **Mathematical & Tactical Engine:** NumPy + SciPy (Gaussian Kernel KDE Heatmaps, Convex Hull, cdist Pressure Grid).
- **Generative AI & Voice (TTS):** Google GenAI SDK (`@google/genai`) with models `gemini-3.8-flash` and `gemini-3.8-flash-tts`.
- **Database & Messaging:** PostgreSQL 16 (GIN Indexes on Spatio-Temporal telemetry) + Redis 7 (Sub-millisecond Pub/Sub).
