/**
 * Tab "Tổng quan & Doanh thu" — card builders.
 * JSX giữ nguyên từ Analytics.tsx; dữ liệu/handler nhận qua AnalyticsCardContext.
 */
import React from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    AreaChart, Area, ComposedChart, Line, LabelList
} from 'recharts';
import { FileText, CreditCard, TrendingUp, Target, Wallet } from 'lucide-react';
import { getChartColors, getAccentColor, getTooltipStyle, getGridStroke, getCursorFill, getMutedBarFill } from '../../../lib/themeColors';
import { ChartCard, EmptyState, KPICard, formatCurrencyGlobal, renderPieLabel } from '../shared';
import type { AnalyticsCardContext } from './types';

export function buildOverviewCards(ctx: AnalyticsCardContext): Record<string, React.ReactNode> {
    const {
        actualStats, effectiveTarget, effectiveCompanyTarget, getYoY,
        structureData, pieTotal, planVsActualData, contractStatusFunnelData,
        contractClassificationData, monthlyTrendData, cumulativeVsTargetData, historicalComparisonData,
        selectedUnit, formatCurrency, formatCurrencyCompact, CustomTooltip,
        handleOpenUnitDetail, handleOpenPersonnelDetail,
    } = ctx;

    return {
        'kpi-summary': (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <KPICard index={0} title="Ký kết" metric="signing" stats={actualStats} target={effectiveTarget} companyTarget={effectiveCompanyTarget} yoy={getYoY('signing')} color="indigo" icon={<FileText size={22} />} />
                <KPICard index={1} title="Doanh thu" metric="revenue" stats={actualStats} target={effectiveTarget} companyTarget={effectiveCompanyTarget} yoy={getYoY('revenue')} color="emerald" icon={<CreditCard size={22} />} />
                <KPICard index={2} title="LNG Quản trị" metric="adminProfit" stats={actualStats} target={effectiveTarget} companyTarget={effectiveCompanyTarget} yoy={getYoY('adminProfit')} color="purple" icon={<TrendingUp size={22} />} />
                <KPICard index={3} title="LNG Doanh thu" metric="revProfit" stats={actualStats} target={effectiveTarget} companyTarget={effectiveCompanyTarget} yoy={getYoY('revProfit')} color="amber" icon={<Target size={22} />} />
                <KPICard index={4} title="Dòng tiền" metric="cash" stats={actualStats} target={effectiveTarget} companyTarget={null} yoy={{ value: '0', isUp: true, lastYearTotal: 0 }} color="cyan" icon={<Wallet size={22} />} />
            </div>
        ),
        'contract-status-funnel': (
            <ChartCard title="Phễu trạng thái Hợp đồng" subtitle="Số lượng & giá trị theo giai đoạn" index={0}>
                {contractStatusFunnelData.length === 0 ? <EmptyState message="Chưa có dữ liệu hợp đồng" /> : (
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={contractStatusFunnelData} layout="vertical" margin={{ left: 0, right: 30, top: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke={getGridStroke()} />
                                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={100} tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                                <Tooltip cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} content={({ active, payload }) => (active && payload && payload.length) ? (
                                    <div style={getTooltipStyle()} className="rounded-lg shadow-xl p-3 border">
                                        <p className="text-xs font-bold text-slate-500 mb-1">{payload[0].payload.name}</p>
                                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(payload[0].payload.value)}</p>
                                        <p className="text-xs text-slate-500 mt-1">{payload[0].payload.count} hợp đồng</p>
                                    </div>
                                ) : null} />
                                <Bar dataKey="value" name="Giá trị" radius={[0, 4, 4, 0]} barSize={26}>
                                    {contractStatusFunnelData.map((_, i) => (<Cell key={i} fill={getChartColors()[i % getChartColors().length]} />))}
                                    <LabelList dataKey="value" position="right" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'contract-classification': (
            <ChartCard title="Cơ cấu Phân loại HĐ" subtitle="Tỷ trọng doanh thu theo phân loại" index={1}>
                {contractClassificationData.length === 0 ? <EmptyState message="Chưa có dữ liệu phân loại" /> : (
                    <div className="h-[300px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ left: 45, right: 45, top: 10, bottom: 10 }}>
                                <Pie
                                    data={contractClassificationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={3}
                                    dataKey="value"
                                    cornerRadius={4}
                                    label={renderPieLabel(contractClassificationData)}
                                >
                                    {contractClassificationData.map((_, i) => (<Cell key={i} fill={getChartColors()[i % getChartColors().length]} strokeWidth={0} />))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                                <Legend verticalAlign="bottom" height={40} content={(props) => (
                                    <div className="flex flex-wrap justify-center gap-3 mt-3">
                                        {props.payload?.map((e, i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{e.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'cumulative-vs-target': (
            <ChartCard title="Doanh thu Lũy kế vs Mục tiêu" subtitle="Tiến độ tích lũy so với kế hoạch năm" index={2}>
                <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={cumulativeVsTargetData}>
                            <defs>
                                <linearGradient id="cumRevGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={getAccentColor()} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={getAccentColor()} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontWeight: 700, fontSize: '12px' }} />
                            <Area type="monotone" dataKey="Lũy kế" stroke={getAccentColor()} strokeWidth={3} fill="url(#cumRevGrad)">
                                <LabelList dataKey="Lũy kế" position="top" offset={8} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                            </Area>
                            <Line type="monotone" dataKey="Mục tiêu" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        ),
        'revenue-structure': (
            <ChartCard
                title={`Cơ cấu Doanh thu ${selectedUnit.id === 'all' ? '(Theo Đơn vị)' : '(Theo Nhân sự)'}`}
                subtitle="Tỷ trọng đóng góp vào tổng doanh thu"
                index={0}
            >
                {structureData.length === 0 ? (
                    <EmptyState message="Chưa có dữ liệu doanh thu" />
                ) : (
                    <>
                        <div className="h-[280px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ left: 45, right: 45, top: 10, bottom: 10 }}>
                                    <Pie
                                        data={structureData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={60}
                                        paddingAngle={4}
                                        dataKey="value"
                                        cornerRadius={6}
                                        label={renderPieLabel(structureData)}
                                        onClick={(dataEntry: any) => {
                                            const payload = dataEntry?.payload ?? dataEntry;
                                            if (!payload?.id) return;
                                            if (selectedUnit.id === 'all') {
                                                handleOpenUnitDetail(payload.id);
                                            } else {
                                                handleOpenPersonnelDetail(payload.id);
                                            }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {structureData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={getChartColors()[index % getChartColors().length]} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Tổng</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{formatCurrencyGlobal(pieTotal)}</p>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2.5">
                            {structureData.slice(0, 5).map((d, i) => (
                                <div key={i} className="flex items-center justify-between group cursor-default">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-md transition-transform group-hover:scale-125" style={{ backgroundColor: getChartColors()[i % getChartColors().length] }} />
                                        <button
                                            onClick={() => {
                                                if (selectedUnit.id === 'all') {
                                                    handleOpenUnitDetail(d.id);
                                                } else {
                                                    handleOpenPersonnelDetail(d.id);
                                                }
                                            }}
                                            className="text-sm font-bold text-slate-600 dark:text-slate-300 truncate max-w-[160px] hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-left focus:outline-none"
                                        >
                                            {d.name}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{pieTotal > 0 ? ((d.value / pieTotal) * 100).toFixed(1) : '0'}%</span>
                                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (d.value / (Math.max(...structureData.map(x => x.value)) || 1)) * 100)}%`, backgroundColor: getChartColors()[i % getChartColors().length] }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </ChartCard>
        ),
        'plan-vs-actual': (
            <ChartCard title="Kế hoạch vs Thực tế" subtitle="So sánh doanh thu thực tế với mục tiêu đặt ra" index={1}>
                {planVsActualData.length === 0 ? (
                    <EmptyState message="Chưa có dữ liệu kế hoạch" />
                ) : (
                    <div className="h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={planVsActualData} barCategoryGap={20} margin={{ bottom: 25 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                    interval={0}
                                    angle={-25}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} />
                                <Legend wrapperStyle={{ paddingTop: '16px', fontWeight: 700, fontSize: '12px' }} />
                                <Bar dataKey="Actual" name="Thực tế" fill={getAccentColor()} radius={[6, 6, 0, 0]} barSize={32}>
                                    <LabelList dataKey="Actual" position="top" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                                </Bar>
                                <Bar dataKey="Target" name="Kế hoạch" fill={getMutedBarFill()} radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'monthly-trend': (
            <ChartCard title="Xu hướng theo tháng" subtitle="Biến động Doanh thu & Lợi nhuận hàng tháng" index={2}>
                <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyTrendData}>
                            <defs>
                                <linearGradient id="colorRevAnalytics" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={getAccentColor()} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={getAccentColor()} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorProfitAnalytics" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontWeight: 700, fontSize: '12px' }} />
                            <Area type="monotone" dataKey="DoanhThu" name="Doanh thu" stroke={getAccentColor()} strokeWidth={3} fillOpacity={1} fill="url(#colorRevAnalytics)" activeDot={{ r: 5, strokeWidth: 2 }}>
                                <LabelList dataKey="DoanhThu" position="top" offset={8} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                            </Area>
                            <Area type="monotone" dataKey="LoiNhuan" name="Lợi nhuận" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfitAnalytics)" activeDot={{ r: 5, strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        ),
        'historical-yoy': historicalComparisonData.length > 0 ? (
            <ChartCard title="So sánh Cùng kỳ (Lịch sử)" subtitle="Theo dõi sự tăng trưởng qua các năm" index={4}>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={historicalComparisonData} barCategoryGap={25}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 700 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 700, fontSize: '12px' }} />
                            <Bar dataKey="Ký kết" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={24} />
                            <Bar dataKey="Doanh thu" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24}>
                                <LabelList dataKey="Doanh thu" position="top" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                            </Bar>
                            <Bar dataKey="LNG QT" fill="#a855f7" radius={[6, 6, 0, 0]} barSize={24} />
                            <Bar dataKey="LNG DT" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>
        ) : null,
    };
}
