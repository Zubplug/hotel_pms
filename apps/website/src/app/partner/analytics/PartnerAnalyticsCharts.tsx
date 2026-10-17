"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; clicks: number; bookings: number };

export function PartnerAnalyticsCharts({ data }: { data: Point[] }) {
  return <section className="reach-card" style={{ marginTop: 18 }}><div className="reach-card-head"><div><span className="reach-eyebrow">Timeline</span><h2>Clicks & bookings</h2><p>Daily activity for the selected period.</p></div></div><div style={{ width: "100%", height: 300 }}>{data.length ? <ResponsiveContainer><LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 8 }}><CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} /><XAxis dataKey="date" tick={{ fill: "#8794aa", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} /><YAxis allowDecimals={false} tick={{ fill: "#8794aa", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#10182a", border: "1px solid rgba(148,163,184,.2)", borderRadius: 10, color: "#edf2f7" }} /><Legend wrapperStyle={{ color: "#8794aa", fontSize: 11 }} /><Line type="monotone" dataKey="clicks" name="Clicks" stroke="#67e8f9" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="bookings" name="Bookings" stroke="#a78bfa" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <div className="reach-empty compact"><strong>No activity in this period</strong></div>}</div></section>;
}
