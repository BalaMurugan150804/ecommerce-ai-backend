import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const API = 'https://ecommerce-ai-backend-mj6s.onrender.com'

const SEGMENT_COLORS = {
  Premium:  '#8b5cf6',
  Trending: '#10b981',
  Budget:   '#0ea5e9',
  Niche:    '#f59e0b',
}

const SEGMENT_ICONS = {
  Premium:  '💎',
  Trending: '🔥',
  Budget:   '💰',
  Niche:    '🎯',
}

const cardCls = "rounded-2xl p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm"

function InputField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold tracking-wider uppercase mb-1.5 text-gray-500 dark:text-slate-400">
        {label}
      </label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all
          bg-gray-50 dark:bg-white/5
          border border-gray-200 dark:border-white/10
          text-gray-900 dark:text-white
          placeholder-gray-400 dark:placeholder-slate-600
          focus:border-violet-400 dark:focus:border-violet-500"
      />
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 shadow-lg text-sm">
      <p className="font-bold text-gray-800 dark:text-white">{payload[0]?.payload?.name}</p>
      <p style={{ color: SEGMENT_COLORS[payload[0]?.payload?.name] }}>{payload[0].value?.toLocaleString()} products</p>
    </div>
  )
  return null
}

function Seller() {
  const [summary,         setSummary]         = useState(null)
  const [topProducts,     setTopProducts]     = useState(null)
  const [activeSegment,   setActiveSegment]   = useState('Trending')
  const [segmentProducts, setSegmentProducts] = useState(null)
  const [loadingSegment,  setLoadingSegment]  = useState(false)

  const [avgPrice,        setAvgPrice]        = useState(3.50)
  const [totalQty,        setTotalQty]        = useState(1000)
  const [numTransactions, setNumTransactions] = useState(150)
  const [numCustomers,    setNumCustomers]    = useState(120)
  const [totalRevenue,    setTotalRevenue]    = useState(3500)
  const [classifyResult,  setClassifyResult]  = useState(null)
  const [classifyLoading, setClassifyLoading] = useState(false)

 useEffect(() => {
  const fetchData = () => {
    axios.get(`${API}/segments/products/summary`)
      .then(res => setSummary(res.data))
      .catch(() => {})

    axios.get(`${API}/insights/top-products`)
      .then(res => setTopProducts(res.data))
      .catch(() => {})
  }
  fetchData()
  const interval = setInterval(fetchData, 30000)
  return () => clearInterval(interval)
}, [])

  useEffect(() => {
    setLoadingSegment(true)
    axios.get(`${API}/segments/products/${activeSegment}?limit=10`)
      .then(res => { setSegmentProducts(res.data); setLoadingSegment(false) })
      .catch(() => setLoadingSegment(false))
  }, [activeSegment])

  const classifyProduct = async () => {
    setClassifyLoading(true); setClassifyResult(null)
    try {
      const res = await axios.post(`${API}/segment/product`, {
        avg_price: parseFloat(avgPrice), total_quantity: parseInt(totalQty),
        num_transactions: parseInt(numTransactions), num_customers: parseInt(numCustomers),
        total_revenue: parseFloat(totalRevenue),
      })
      setClassifyResult(res.data)
    } catch { setClassifyResult({ error: 'API error. Make sure FastAPI is running.' }) }
    setClassifyLoading(false)
  }

  const chartData = summary
    ? Object.entries(summary.segments).map(([name, data]) => ({ name, count: data.count, percentage: data.percentage }))
    : []

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">📦 Seller Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          K-Means Product Clustering — Understand and manage your inventory
        </p>
      </div>

      {/* Segment Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(summary.segments).map(([seg, data]) => (
            <div key={seg} onClick={() => setActiveSegment(seg)}
              className="rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 hover:scale-105 select-none border-2"
              style={{
                borderColor: activeSegment === seg ? SEGMENT_COLORS[seg] : 'transparent',
                backgroundColor: SEGMENT_COLORS[seg] + '12',
                boxShadow: activeSegment === seg ? `0 0 20px ${SEGMENT_COLORS[seg]}25` : 'none',
              }}>
              <p className="text-3xl mb-2">{SEGMENT_ICONS[seg]}</p>
              <p className="font-bold text-sm" style={{ color: SEGMENT_COLORS[seg] }}>{seg}</p>
              <p className="text-3xl font-black mt-1 text-gray-900 dark:text-white">{data.count.toLocaleString()}</p>
              <p className="text-xs mt-0.5 text-gray-500 dark:text-slate-400">{data.percentage}%</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Products in Selected Segment */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {SEGMENT_ICONS[activeSegment]}{' '}
              <span style={{ color: SEGMENT_COLORS[activeSegment] }}>{activeSegment}</span> Products
            </h2>
            <div className="flex gap-1.5">
              {Object.keys(SEGMENT_COLORS).map(seg => (
                <button key={seg} onClick={() => setActiveSegment(seg)}
                  className="text-xs px-2.5 py-1 rounded-lg transition-all font-semibold"
                  style={{
                    backgroundColor: activeSegment === seg ? SEGMENT_COLORS[seg] : 'transparent',
                    color: activeSegment === seg ? '#fff' : SEGMENT_COLORS[seg],
                    border: `1px solid ${SEGMENT_COLORS[seg]}`,
                  }}>
                  {seg}
                </button>
              ))}
            </div>
          </div>

          {loadingSegment ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                   style={{ borderColor: SEGMENT_COLORS[activeSegment], borderTopColor: 'transparent' }} />
            </div>
          ) : segmentProducts ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {segmentProducts.products.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl
                  bg-gray-50 dark:bg-white/[0.03]
                  border border-gray-100 dark:border-white/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-800 dark:text-white">{p.Description}</p>
                    <p className="text-xs mt-0.5 text-gray-400 dark:text-slate-500">
                      £{p.avg_price?.toFixed(2)} avg · {p.num_transactions} transactions
                    </p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">£{(p.total_revenue / 1000).toFixed(1)}k</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">revenue</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {segmentProducts && (
            <p className="text-xs mt-3 text-right text-gray-400 dark:text-slate-500">
              Showing 10 of {segmentProducts.count} products
            </p>
          )}
        </div>

        {/* Classify a Product */}
        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">🔍 Classify a New Product</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">Enter product metrics to predict its segment.</p>

          <div className="space-y-3">
            {[
              { label: 'Average Price (£)',       value: avgPrice,        setter: setAvgPrice,        placeholder: '3.50' },
              { label: 'Total Quantity Sold',     value: totalQty,        setter: setTotalQty,        placeholder: '1000' },
              { label: 'Number of Transactions',  value: numTransactions, setter: setNumTransactions, placeholder: '150' },
              { label: 'Number of Customers',     value: numCustomers,    setter: setNumCustomers,    placeholder: '120' },
              { label: 'Total Revenue (£)',        value: totalRevenue,    setter: setTotalRevenue,    placeholder: '3500' },
            ].map(field => (
              <InputField key={field.label} label={field.label} value={field.value}
                onChange={field.setter} placeholder={field.placeholder} />
            ))}

            <button onClick={classifyProduct} disabled={classifyLoading}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-40
                bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 shadow-md">
              {classifyLoading ? '⏳ Classifying…' : '🔍 Classify Product'}
            </button>
          </div>

          {classifyResult && !classifyResult.error && (
            <div className="mt-5 p-4 rounded-xl border-2"
                 style={{ borderColor: SEGMENT_COLORS[classifyResult.segment] + '60', backgroundColor: SEGMENT_COLORS[classifyResult.segment] + '10' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{SEGMENT_ICONS[classifyResult.segment]}</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Product Segment</p>
                  <p className="text-2xl font-black" style={{ color: SEGMENT_COLORS[classifyResult.segment] }}>
                    {classifyResult.segment}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-slate-300">{classifyResult.segment_description}</p>
              <div className="mt-3 p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                <p className="text-xs font-bold tracking-widest uppercase mb-1 text-gray-400 dark:text-slate-500">💡 Seller Action</p>
                <p className="text-sm text-gray-700 dark:text-slate-200">{classifyResult.seller_action}</p>
              </div>
            </div>
          )}

          {classifyResult?.error && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{classifyResult.error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Products Table */}
      {topProducts && (
        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5">🏆 Top Products by Revenue</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/10">
                  {['#', 'Product', 'Avg Price', 'Qty Sold', 'Revenue', 'Segment'].map((h, i) => (
                    <th key={h}
                      className={`py-3 px-3 text-xs font-semibold tracking-wider uppercase text-gray-400 dark:text-slate-500 ${i >= 2 && i < 5 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topProducts.products.map((p, i) => (
                  <tr key={i} className={`border-b border-gray-50 dark:border-white/5 ${i % 2 === 0 ? 'bg-gray-50/60 dark:bg-white/[0.02]' : ''}`}>
                    <td className="py-3 px-3 text-gray-400 dark:text-slate-600">{i + 1}</td>
                    <td className="py-3 px-3 font-medium text-gray-800 dark:text-white max-w-xs truncate">{p.Description}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-slate-300">£{p.avg_price?.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-gray-600 dark:text-slate-300">{p.total_quantity?.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">£{(p.total_revenue / 1000).toFixed(1)}k</td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold"
                            style={{ backgroundColor: SEGMENT_COLORS[p.Segment] + '18', color: SEGMENT_COLORS[p.Segment], border: `1px solid ${SEGMENT_COLORS[p.Segment]}30` }}>
                        {SEGMENT_ICONS[p.Segment]} {p.Segment}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      {summary && (
        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">📊 Product Segment Distribution</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
            Across {Object.keys(summary.segments).length} product segments
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={SEGMENT_COLORS[entry.name] || '#888'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  )
}

export default Seller
