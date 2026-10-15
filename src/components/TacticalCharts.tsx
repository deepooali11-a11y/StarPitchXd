import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Activity, Gauge, BarChart3, TrendingUp } from 'lucide-react';

export interface TelemetryPoint {
  time: string;
  pressure: number;
  maxSpeed: number;
}

interface TacticalChartsProps {
  data: TelemetryPoint[];
  liveStats?: {
    possessionHome: number;
    possessionAway: number;
    xgHome: number;
    xgAway: number;
    ppdaHome: number;
    ppdaAway: number;
  };
}

export const TacticalCharts: React.FC<TacticalChartsProps> = ({
  data,
  liveStats = {
    possessionHome: 58.2,
    possessionAway: 41.8,
    xgHome: 2.34,
    xgAway: 0.96,
    ppdaHome: 6.8,
    ppdaAway: 12.4,
  },
}) => {
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'COMPARISON'>('TELEMETRY');

  const comparisonData = [
    { metric: 'الاستحواذ (%)', home: liveStats.possessionHome, away: liveStats.possessionAway },
    { metric: 'الأهداف المتوقعة (xG x10)', home: Math.round(liveStats.xgHome * 10), away: Math.round(liveStats.xgAway * 10) },
    { metric: 'مؤشر الضغط (PPDA)', home: liveStats.ppdaHome, away: liveStats.ppdaAway },
    { metric: 'السرعة القصوى (كم/س)', home: 35.1, away: 34.2 },
    { metric: 'المساحة التكتيكية (م² / 10)', home: 94.5, away: 88.0 },
  ];

  return (
    <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">
            التحليلات والمؤشرات الإحصائية اللحظية (Tactical Metrics)
          </h3>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('TELEMETRY')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition ${
              activeTab === 'TELEMETRY'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            الضغط والسرعة (Live)
          </button>
          <button
            onClick={() => setActiveTab('COMPARISON')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md font-medium transition ${
              activeTab === 'COMPARISON'
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            مقارنة الفريقين
          </button>
        </div>
      </div>

      <div className="h-60 w-full">
        {activeTab === 'TELEMETRY' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="pressureGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090d16',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="pressure"
                name="شدة الضغط (%)"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#pressureGrad)"
              />
              <Area
                type="monotone"
                dataKey="maxSpeed"
                name="أقصى سرعة (كم/س)"
                stroke="#38bdf8"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#speedGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="metric" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090d16',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                formatter={(val) => (val === 'home' ? 'الفريق المضيف' : 'الفريق الضيف')}
              />
              <Bar dataKey="home" name="home" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="away" name="away" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1 text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" />
          معدل الأداء الهجومي مرتفع بنسبة 18% مقارنة بمتوسط الدوري
        </span>
        <span className="font-mono text-slate-500">Sampling Rate: 25Hz</span>
      </div>
    </div>
  );
};
