/**
 * Tab "Dòng tiền & Thanh toán" — card builders.
 * JSX giữ nguyên từ Analytics.tsx; dữ liệu/handler nhận qua AnalyticsCardContext.
 */
import React from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    AreaChart, Area, ComposedChart, Line, LabelList
} from 'recharts';
import { getTooltipStyle, getGridStroke, getCursorFill, getMutedBarFill } from '../../../lib/themeColors';
import { ChartCard, EmptyState, renderPieLabel } from '../shared';
import type { AnalyticsCardContext } from './types';

export function buildCashflowCards(ctx: AnalyticsCardContext): Record<string, React.ReactNode> {
    const {
        cashflowData, cumulativeCashflowData, paymentStatusData, arAgingData,
        topReceivablesData, collectionRateData,
        formatCurrency, formatCurrencyCompact, CustomTooltip, handleOpenContractDetail,
    } = ctx;

    return {
        'cashflow': (
            <ChartCard title="Dòng tiền Thu – Chi" subtitle="Phân tích luồng tiền vào/ra hàng tháng" index={3}>
                <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={cashflowData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontWeight: 700, fontSize: '12px' }} />
                            <Bar dataKey="Thu" name="Dòng tiền vào" fill="#10b981" radius={[6, 6, 0, 0]} barSize={28}>
                                <LabelList dataKey="Thu" position="top" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                            </Bar>
                            <Bar dataKey="Chi" name="Dòng tiền ra" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={28} />
                            <Line type="monotone" dataKey="Rong" name="Dòng tiền ròng" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: '#0ea5e9' }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        ),
        'cumulative-cashflow': (
            <ChartCard title="Số dư Dòng tiền Lũy kế" subtitle="Tích lũy dòng tiền ròng theo tháng" index={6}>
                <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cumulativeCashflowData}>
                            <defs>
                                <linearGradient id="cumBalGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                            <Area type="monotone" dataKey="Số dư" stroke="#0ea5e9" strokeWidth={3} fill="url(#cumBalGrad)" activeDot={{ r: 5 }}>
                                <LabelList dataKey="Số dư" position="top" offset={8} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                            </Area>
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        ),
        'payment-status': (
            <ChartCard title="Tiến độ Thanh toán" subtitle="Tình trạng thu hồi doanh thu thực tế" index={7}>
                {paymentStatusData.length === 0 ? <EmptyState message="Chưa có dữ liệu thanh toán" /> : (
                    <div className="h-[250px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ left: 45, right: 45, top: 10, bottom: 10 }}>
                                <Pie
                                    data={paymentStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={30}
                                    outerRadius={50}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={renderPieLabel(paymentStatusData)}
                                >
                                    {paymentStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={40}
                                    content={(props) => (
                                        <div className="flex flex-wrap justify-center gap-4 mt-2">
                                            {props.payload?.map((entry, index) => (
                                                <div key={`item-${index}`} className="flex items-center gap-1.5 focus:outline-none">
                                                    <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: entry.color, borderRadius: '4px' }} />
                                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{entry.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'ar-aging': (
            <ChartCard title="Công nợ phải thu theo tuổi nợ" subtitle="Số tiền chưa thu theo số ngày quá hạn" index={3}>
                {arAgingData.length === 0 ? <EmptyState message="Không có công nợ tồn đọng" /> : (
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={arAgingData} margin={{ left: -10, top: 10, right: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }} />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} />
                                <Bar dataKey="value" name="Công nợ" radius={[4, 4, 0, 0]} barSize={40}>
                                    {arAgingData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                                    <LabelList dataKey="value" position="top" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'top-receivables': (
            <ChartCard title="Top HĐ tồn đọng công nợ" subtitle="Giá trị chưa thu lớn nhất (bấm để xem)" index={4}>
                {topReceivablesData.length === 0 ? <EmptyState message="Không có công nợ tồn đọng" /> : (
                    <div className="space-y-2.5 h-[280px] overflow-y-auto styled-scrollbar pr-1">
                        {topReceivablesData.map((d) => {
                            const maxV = topReceivablesData[0].value || 1;
                            return (
                                <button key={d.id} onClick={() => handleOpenContractDetail(d.id, d.code)} className="w-full text-left group cursor-pointer focus:outline-none">
                                    <div className="flex justify-between items-center mb-1 gap-2">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400" title={d.title}>{d.code} · {d.title}</span>
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 shrink-0">{formatCurrencyCompact(d.value)}</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600" style={{ width: `${(d.value / maxV) * 100}%` }} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </ChartCard>
        ),
        'collection-rate-trend': (
            <ChartCard title="Tỷ lệ Thu hồi theo tháng" subtitle="Tiền về so với doanh thu ghi nhận" index={5}>
                <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={collectionRateData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
                            <Tooltip cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} content={({ active, payload, label }) => (active && payload && payload.length) ? (
                                <div style={getTooltipStyle()} className="rounded-lg shadow-xl p-3 border">
                                    <p className="text-xs font-bold text-slate-500 mb-1">{label}</p>
                                    {payload.map((e, i) => (<p key={i} className="text-xs font-bold" style={{ color: e.color }}>{e.name}: {e.dataKey === 'Tỷ lệ' ? `${Math.round(e.value as number)}%` : formatCurrency(e.value as number)}</p>))}
                                </div>
                            ) : null} />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontWeight: 700, fontSize: '12px' }} />
                            <Bar yAxisId="left" dataKey="Tiền về" fill="#10b981" radius={[4, 4, 0, 0]} barSize={18}>
                                <LabelList dataKey="Tiền về" position="top" offset={6} style={{ fontSize: 8, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                            </Bar>
                            <Bar yAxisId="left" dataKey="Doanh thu" fill={getMutedBarFill()} radius={[4, 4, 0, 0]} barSize={18} />
                            <Line yAxisId="right" type="monotone" dataKey="Tỷ lệ" stroke="#6366f1" strokeWidth={3} dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        ),
    };
}
