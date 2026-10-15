# services/genai_service/main.py
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from gemini_agent import GeminiTacticalAssistant
from report_generator import generate_match_pdf_report

app = FastAPI(title="VideoAnalyst X - GenAI & Reporting Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

assistant = GeminiTacticalAssistant()

DEFAULT_MATCH_EVENTS = [
    {
        "event_type": "HIGH_PRESSURE",
        "period": 1,
        "video_timestamp_sec": 740.0,
        "team_side": "HOME",
        "xg_value": 0.42,
        "impact_score": 9.4,
        "description_ar": "استخلاص عالي للكرة في الثلث الهجومي بعد ضغط ثلاثي منظم أدى لانفراد مباشر بالمرمى"
    },
    {
        "event_type": "GOAL",
        "period": 1,
        "video_timestamp_sec": 1695.0,
        "team_side": "HOME",
        "xg_value": 0.68,
        "impact_score": 9.8,
        "description_ar": "هدف التقدم بعد سلسلة من 7 تمريرات سريعة كسرت خط الوسط الدفاعي وتمريرة بينية في المساحة النصفية"
    },
    {
        "event_type": "SHOT",
        "period": 1,
        "video_timestamp_sec": 2470.0,
        "team_side": "AWAY",
        "xg_value": 0.51,
        "impact_score": 8.9,
        "description_ar": "هجمة مرتدة خاطفة للفريق الضيف بسرعة 34.2 كم/ساعة انتهت بتسديدة ارتطمت بالعارضة"
    }
]


class ChatRequest(BaseModel):
    match_id: str
    query: str


@app.post("/api/v1/genai/chat")
async def chat_with_analyst(req: ChatRequest):
    """نقطة النهاية الخاصة بالمساعد الذكي للرد على أسئلة المحللين مع روابط الفيديو."""
    return assistant.answer_query(
        match_id=req.match_id,
        user_query=req.query,
        match_events=DEFAULT_MATCH_EVENTS
    )


@app.get("/api/v1/genai/report/{match_id}/pdf")
async def download_pdf_report(match_id: str):
    """توليد وتحميل التقرير التكتيكي الكامل بصيغة PDF."""
    summary_data = {
        "home_possession": 58.2,
        "away_possession": 41.8,
        "home_xg": 2.34,
        "away_xg": 0.96,
        "home_ppda": "6.8 PPDA",
        "away_ppda": "12.4 PPDA",
        "home_hull_m2": 962.5,
        "away_hull_m2": 845.0,
        "home_max_speed": 35.1,
        "away_max_speed": 34.2,
    }
    pdf_bytes = generate_match_pdf_report(match_id, summary_data, DEFAULT_MATCH_EVENTS)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="VideoAnalystX_Report_{match_id}.pdf"'}
    )
