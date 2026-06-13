/**
 * Tab "Sản phẩm & Đối tác" — card builders.
 * JSX giữ nguyên từ Analytics.tsx; dữ liệu/handler nhận qua AnalyticsCardContext.
 */
import React from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    ComposedChart, Line, ScatterChart, Scatter, ZAxis, LabelList
} from 'recharts';
import { getChartColors, getTooltipStyle, getGridStroke, getCursorFill } from '../../../lib/themeColors';
import {
    ChartCard, EmptyState, formatCurrencyGlobal, renderPieLabel,
    BrandYAxisTick, ProductYAxisTick, BrandParetoXAxisTick,
} from '../shared';
import type { AnalyticsCardContext } from './types';

export function buildProductBrandCards(ctx: AnalyticsCardContext): Record<string, React.ReactNode> {
    const {
        topBrandsData, productCategoryData, brandProfitabilityData, productQuantityData,
        brandQuantityData, brandProfitStructureData, brandMatrixData, brandParetoData,
        products, formatCurrency, formatCurrencyCompact, CustomTooltip,
        handleOpenBrandDetail, handleOpenProductDetail, openContractDrillDown,
    } = ctx;

    return {
        'top-brands': (
            <ChartCard title="Top Hãng / Đối tác" subtitle="Đóng góp nhiều doanh thu nhất" index={5}>
                {topBrandsData.length === 0 ? <EmptyState message="Chưa có dữ liệu hãng" /> : (
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topBrandsData} layout="vertical" margin={{ left: -10, top: 10, bottom: 0, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke()} />
                                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    width={130}
                                    tick={<BrandYAxisTick data={topBrandsData} onOpen={handleOpenBrandDetail} />}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} />
                                <Bar dataKey="value" name="Doanh thu" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={16} onClick={(d: any) => openContractDrillDown(d?.payload ?? d)} style={{ cursor: 'pointer' }}>
                                    {topBrandsData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'][index]} />
                                    ))}
                                    <LabelList dataKey="value" position="right" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'product-category': (
            <ChartCard title="Nhóm Sản Phẩm" subtitle="Tỷ trọng doanh thu theo nhóm" index={6}>
                {productCategoryData.length === 0 ? <EmptyState message="Chưa có dữ liệu sản phẩm" /> : (
                    <div className="h-[300px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ left: 45, right: 45, top: 10, bottom: 10 }}>
                                <Pie
                                    data={productCategoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={55}
                                    paddingAngle={4}
                                    dataKey="value"
                                    cornerRadius={4}
                                    label={renderPieLabel(productCategoryData)}
                                    onClick={(d: any) => openContractDrillDown(d?.payload ?? d)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {productCategoryData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#f43f5e'][index % 7]} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={60}
                                    content={(props) => (
                                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 px-2">
                                            {props.payload?.map((entry, index) => (
                                                <div key={`item-${index}`} className="flex items-center gap-1.5 min-w-fit">
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 capitalize whitespace-nowrap">{entry.value}</span>
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
        'brand-margin': (
            <ChartCard title="Tỷ suất Lợi nhuận" subtitle="Top biên lợi nhuận (%) theo Hãng" index={9}>
                {brandProfitabilityData.length === 0 ? <EmptyState message="Chưa có dữ liệu lợi nhuận" /> : (
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={brandProfitabilityData} layout="vertical" margin={{ left: -10, top: 10, bottom: 0, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke()} />
                                <XAxis type="number" domain={[0, 'dataMax + 10']} axisLine={false} tickLine={false} tickFormatter={(val) => `${Math.round(val)}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    width={130}
                                    tick={<BrandYAxisTick data={brandProfitabilityData} onOpen={handleOpenBrandDetail} />}
                                />
                                <Tooltip
                                    cursor={{ fill: getCursorFill() }}
                                    wrapperStyle={{ zIndex: 100 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div style={getTooltipStyle()} className="rounded-lg shadow-xl p-3 border">
                                                    <p className="text-xs font-bold text-slate-500 mb-1">{data.name}</p>
                                                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">Biên lợi nhuận: {data.value.toFixed(1)}%</p>
                                                    <p className="text-xs text-slate-500 mt-1">(Doanh thu DT: {formatCurrency(data.revenue)})</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="value" name="Biên LN (%)" fill="#10b981" radius={[0, 4, 4, 0]} barSize={22} onClick={(d: any) => openContractDrillDown(d?.payload ?? d)} style={{ cursor: 'pointer' }}>
                                    <LabelList dataKey="value" position="right" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? `${v.toFixed(1)}%` : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'product-qty': (
            <ChartCard title="Số lượng Sản phẩm đã bán" subtitle="Top 5 họ sản phẩm bán chạy nhất theo số lượng" index={10}>
                {productQuantityData.length === 0 ? <EmptyState message="Chưa có dữ liệu sản phẩm" /> : (
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={productQuantityData} layout="vertical" margin={{ left: -10, top: 10, bottom: 0, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke()} />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    width={150}
                                    tick={<ProductYAxisTick products={products} onOpen={handleOpenProductDetail} />}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} />
                                <Bar dataKey="value" name="Số lượng" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} onClick={(d: any) => openContractDrillDown(d?.payload ?? d)} style={{ cursor: 'pointer' }}>
                                    {productQuantityData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'][index]} />
                                    ))}
                                    <LabelList dataKey="value" position="right" offset={6} style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'brand-qty': (
            <ChartCard title="Số lượng Hãng đã bán" subtitle="Top 5 hãng có số lượng sản phẩm bán chạy nhất" index={11}>
                {brandQuantityData.length === 0 ? <EmptyState message="Chưa có dữ liệu hãng" /> : (
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={brandQuantityData} layout="vertical" margin={{ left: -10, top: 10, bottom: 0, right: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke()} />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    width={130}
                                    tick={<BrandYAxisTick data={brandQuantityData} onOpen={handleOpenBrandDetail} />}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} />
                                <Bar dataKey="value" name="Số lượng" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={16} onClick={(d: any) => openContractDrillDown(d?.payload ?? d)} style={{ cursor: 'pointer' }}>
                                    {brandQuantityData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={['#db2777', '#ec4899', '#f472b6', '#fbcfe8', '#fce7f3'][index]} />
                                    ))}
                                    <LabelList dataKey="value" position="right" offset={6} style={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'brand-profit-structure': (
            <ChartCard title="Cơ cấu Lợi nhuận Hãng" subtitle="Tỷ trọng đóng góp lợi nhuận gộp" index={12}>
                {brandProfitStructureData.length === 0 ? <EmptyState message="Chưa có dữ liệu lợi nhuận" /> : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 sm:h-[300px]">
                        <div className="w-full h-[220px] sm:flex-1 sm:h-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ left: 45, right: 45, top: 10, bottom: 10 }}>
                                    <Pie
                                        data={brandProfitStructureData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={55}
                                        paddingAngle={3}
                                        dataKey="value"
                                        cornerRadius={4}
                                        label={renderPieLabel(brandProfitStructureData)}
                                        onClick={(dataEntry: any) => {
                                            const payload = dataEntry?.payload ?? dataEntry;
                                            if (payload?.brandId) {
                                                handleOpenBrandDetail(payload.brandId);
                                            } else {
                                                openContractDrillDown(payload);
                                            }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {brandProfitStructureData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={getChartColors()[index % getChartColors().length]} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 100 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tổng LN</p>
                                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{formatCurrencyGlobal(brandProfitStructureData.reduce((s, d) => s + d.value, 0))}</p>
                            </div>
                        </div>
                        <div className="w-full sm:w-[40%] sm:max-w-[240px] shrink-0 max-h-[180px] sm:max-h-full overflow-y-auto pr-1 styled-scrollbar space-y-1 flex flex-col justify-center">
                            {brandProfitStructureData.map((d, i) => {
                                const totalProfit = brandProfitStructureData.reduce((s, x) => s + x.value, 0);
                                return (
                                    <div key={i} className="flex items-center justify-between group cursor-default py-0.5 border-b border-slate-100/50 dark:border-slate-800/50 last:border-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-2.5 h-2.5 rounded-md shrink-0" style={{ backgroundColor: getChartColors()[i % getChartColors().length] }} />
                                            {d.brandId ? (
                                                <button
                                                    onClick={() => handleOpenBrandDetail(d.brandId)}
                                                    className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer text-left focus:outline-none"
                                                    title={d.name}
                                                >
                                                    {d.name}
                                                </button>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={d.name}>{d.name}</span>
                                            )}
                                        </div>
                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 ml-2 shrink-0">{totalProfit > 0 ? ((d.value / totalProfit) * 100).toFixed(1) : '0'}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </ChartCard>
        ),
        'brand-bcg': (
            <ChartCard title="Ma trận Hãng (Doanh thu × Biên LN)" subtitle="X: doanh thu · Y: biên LN% · kích thước: số lượng" index={7}>
                {brandMatrixData.length === 0 ? <EmptyState message="Chưa có dữ liệu hãng" /> : (
                    <div className="h-[360px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={getGridStroke()} />
                                <XAxis type="number" dataKey="x" name="Doanh thu" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis type="number" dataKey="y" name="Biên LN" axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <ZAxis type="number" dataKey="z" range={[60, 600]} name="Số lượng" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} wrapperStyle={{ zIndex: 100 }} content={({ active, payload }) => (active && payload && payload.length) ? (
                                    <div style={getTooltipStyle()} className="rounded-lg shadow-xl p-3 border">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{payload[0].payload.name}</p>
                                        <p className="text-xs text-slate-500">Doanh thu: {formatCurrency(payload[0].payload.x)}</p>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Biên LN: {payload[0].payload.y.toFixed(1)}%</p>
                                        <p className="text-xs text-slate-500">Số lượng: {payload[0].payload.z}</p>
                                    </div>
                                ) : null} />
                                <Scatter data={brandMatrixData} onClick={(d: any) => {
                                    const payload = d?.payload ?? d;
                                    if (payload?.brandId) {
                                        handleOpenBrandDetail(payload.brandId);
                                    }
                                }} style={{ cursor: 'pointer' }}>
                                    <LabelList dataKey="name" position="top" offset={8} fill="#64748b" style={{ fontSize: 10, fontWeight: 700 }} />
                                    {brandMatrixData.map((_, i) => (<Cell key={i} fill={getChartColors()[i % getChartColors().length]} />))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
        'revenue-pareto': (
            <ChartCard title="Pareto Doanh thu theo Hãng" subtitle="Quy tắc 80/20 — mức độ tập trung doanh thu" index={8}>
                {brandParetoData.length === 0 ? <EmptyState message="Chưa có dữ liệu hãng" /> : (
                    <div className="h-[360px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={brandParetoData} margin={{ left: 0, right: 10, top: 10, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0}
                                    height={60}
                                    tick={<BrandParetoXAxisTick data={brandParetoData} onOpen={handleOpenBrandDetail} />}
                                />
                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip cursor={{ fill: getCursorFill() }} wrapperStyle={{ zIndex: 100 }} content={({ active, payload }) => (active && payload && payload.length) ? (
                                    <div style={getTooltipStyle()} className="rounded-lg shadow-xl p-3 border">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{payload[0].payload.name}</p>
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400">Doanh thu: {formatCurrency(payload[0].payload.value)}</p>
                                        <p className="text-xs text-orange-500">Lũy kế: {payload[0].payload.cum.toFixed(1)}%</p>
                                    </div>
                                ) : null} />
                                <Bar yAxisId="left" dataKey="value" name="Doanh thu" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20}
                                    onClick={(d: any) => {
                                        const payload = d?.payload ?? d;
                                        if (payload?.brandId) {
                                            handleOpenBrandDetail(payload.brandId);
                                        }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <LabelList dataKey="value" position="top" offset={6} style={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} formatter={(v: any) => v > 0 ? formatCurrencyCompact(v) : ''} />
                                </Bar>
                                <Line yAxisId="right" type="monotone" dataKey="cum" name="Lũy kế %" stroke="#f97316" strokeWidth={3} dot={{ r: 2 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        ),
    };
}
