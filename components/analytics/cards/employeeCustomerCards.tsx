/**
 * Tab "Hiệu suất & Khách hàng" — card builders.
 * JSX giữ nguyên từ Analytics.tsx; dữ liệu/handler nhận qua AnalyticsCardContext.
 */
import React from 'react';
import {
    Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList
} from 'recharts';
import { getChartColors, getTooltipStyle, getGridStroke, getCursorFill } from '../../../lib/themeColors';
import { ChartCard, EmptyState, CustomerYAxisTick, EmployeeYAxisTick } from '../shared';
import type { AnalyticsCardContext } from './types';

export function buildEmployeeCustomerCards(ctx: AnalyticsCardContext): Record<string, React.ReactNode> {
    const {
        topCustomersData, topEmployeesData, employeeCompletionData,
        newVsReturningData, dealSizeData, cycleTimeData,
        formatCurrency, formatCurrencyCompact, CustomTooltip,
        handleOpenCustomerDetail, handleOpenPersonnelDetail, openContractDrillDown,
    } = ctx;

    return {
        'top-customers': (
            <ChartCard title="Top Khách hàng" subtitle="Hàng đầu theo Danh thu" index={4}>
                {topCustomersData.length === 0 ? <EmptyState message="Chưa có dữ liệu khách hàng" /> : (
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topCustomersData} layout="vertical" margin={{ left: -10, top: 10, bottom: 0, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke()} />
                                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    width={150}
                                    tick={<CustomerYAxisTick data={topCustomersData} onOpen={handleOpenCustomerDetail} />}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} />
                                <Bar dataKey="value" name="Doanh thu" fill="#f97316" radius={[0, 4, 4, 0]} barSize={16} onClick={(d: any) => openContractDrillDown(d?.payload ?? d)} style={{ cursor: 'pointer' }}>
                                    {topCustomersData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'][index]} />
                                    ))}
                                    <LabelList dataKey="value" position="right" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'top-employees': (
            <ChartCard title="Hiệu suất Nhân sự" subtitle="Top Doanh số theo Nhân viên" index={8}>
                {topEmployeesData.length === 0 ? <EmptyState message="Chưa có dữ liệu sales" /> : (
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topEmployeesData} layout="vertical" margin={{ left: -10, top: 10, bottom: 0, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke()} />
                                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    width={120}
                                    tick={<EmployeeYAxisTick data={topEmployeesData} onOpen={handleOpenPersonnelDetail} />}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} />
                                <Bar dataKey="value" name="Doanh số" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} onClick={(d: any) => openContractDrillDown(d?.payload ?? d)} style={{ cursor: 'pointer' }}>
                                    {topEmployeesData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'][index]} />
                                    ))}
                                    <LabelList dataKey="value" position="right" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'employee-target-completion': (
            <ChartCard title="Hoàn thành KPI theo Nhân sự" subtitle="Doanh thu thực tế so với chỉ tiêu" index={3}>
                {employeeCompletionData.length === 0 ? <EmptyState message="Chưa có chỉ tiêu nhân sự" /> : (
                    <div className="space-y-3 max-h-[360px] overflow-y-auto styled-scrollbar pr-1">
                        {employeeCompletionData.map((d) => (
                            <div key={d.id}>
                                <div className="flex justify-between items-center mb-1 gap-2">
                                    <button
                                        onClick={() => handleOpenPersonnelDetail(d.id)}
                                        className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-left focus:outline-none"
                                    >
                                        {d.name}
                                    </button>
                                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 shrink-0">
                                        {formatCurrencyCompact(d.actual)} / {formatCurrencyCompact(d.target)}
                                        {d.target > 0 ? (
                                            <>
                                                {' '}·{' '}
                                                <span className={d.pct >= 100 ? 'text-emerald-500' : d.pct >= 70 ? 'text-amber-500' : 'text-rose-500'}>
                                                    {Math.round(d.pct)}%
                                                </span>
                                            </>
                                        ) : (
                                            <> · <span className="text-slate-400 dark:text-slate-500">—</span></>
                                        )}
                                    </span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.pct)}%`, backgroundColor: d.pct >= 100 ? '#10b981' : d.pct >= 70 ? '#f59e0b' : '#f43f5e' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ChartCard>
        ),
        'new-vs-returning-customers': (
            <ChartCard title="Khách hàng Mới vs Quay lại" subtitle="Số khách phát sinh HĐ theo tháng (trong kỳ)" index={4}>
                <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={newVsReturningData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} content={({ active, payload, label }) => (active && payload && payload.length) ? (
                                <div style={getTooltipStyle()} className="rounded-lg shadow-xl p-3 border">
                                    <p className="text-xs font-bold text-slate-500 mb-1">{label}</p>
                                    {payload.map((e, i) => (<p key={i} className="text-xs font-bold" style={{ color: e.color }}>{e.name}: {e.value} KH</p>))}
                                </div>
                            ) : null} />
                            <Legend wrapperStyle={{ paddingTop: '12px', fontWeight: 700, fontSize: '12px' }} />
                            <Bar dataKey="Mới" stackId="a" fill="#10b981" barSize={22} />
                            <Bar dataKey="Quay lại" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={22}>
                                <LabelList position="top" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} valueAccessor={(entry: any) => { const t = (entry?.['Mới'] || 0) + (entry?.['Quay lại'] || 0); return t > 0 ? t : ''; }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        ),
        'deal-size-distribution': (
            <ChartCard title="Phân bố Quy mô Hợp đồng" subtitle="Số lượng HĐ theo khoảng giá trị" index={5}>
                <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dealSizeData} margin={{ left: -15, top: 10, right: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }} />
                            <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                            <Tooltip cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} content={({ active, payload }) => (active && payload && payload.length) ? (
                                <div style={getTooltipStyle()} className="rounded-lg shadow-xl p-3 border">
                                    <p className="text-xs font-bold text-slate-500 mb-1">{payload[0].payload.name}</p>
                                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{payload[0].payload.count} hợp đồng</p>
                                </div>
                            ) : null} />
                            <Bar dataKey="count" name="Số HĐ" radius={[4, 4, 0, 0]} barSize={44}>
                                {dealSizeData.map((_, i) => (<Cell key={i} fill={getChartColors()[i % getChartColors().length]} />))}
                                <LabelList dataKey="count" position="top" offset={6} style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? v : ''} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        ),
        'cycle-time': (
            <ChartCard title="Thời gian xử lý Hợp đồng" subtitle="Số ngày trung bình giữa các mốc" index={6}>
                {cycleTimeData.length === 0 ? <EmptyState message="Chưa đủ dữ liệu ngày tháng" /> : (
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cycleTimeData} layout="vertical" margin={{ left: 20, top: 10, right: 20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke={getGridStroke()} />
                                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}d`} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={140} tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }} />
                                <Tooltip cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} content={({ active, payload }) => (active && payload && payload.length) ? (
                                    <div style={getTooltipStyle()} className="rounded-lg shadow-xl p-3 border">
                                        <p className="text-xs font-bold text-slate-500 mb-1">{payload[0].payload.name}</p>
                                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{payload[0].payload.value} ngày</p>
                                    </div>
                                ) : null} />
                                <Bar dataKey="value" name="Ngày" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={28}>
                                    <LabelList dataKey="value" position="right" offset={6} style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? `${v} ngày` : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
    };
}
