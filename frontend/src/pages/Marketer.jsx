import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const API = 'https://ecommerce-ai-backend-mj6s.onrender.com'

const SEGMENT_COLORS = {
  Champions: '#10b981',
  Loyal:     '#0ea5e9',
  'At-Risk': '#f59e0b',
  Lost:      '#f43f5e',
}

const SEGMENT_ICONS = {
  Champions: '🏆',
  Loyal:     '💙',
  'At-Risk': '⚠️',
  Lost:      '❌',
}

const CAMPAIGN_STRATEGIES = {
  Champions: {
    icon: '🏆', strategy: 'VIP Loyalty Campaign', color: '#10b981',
    description: 'Reward your best customers with exclusive deals, early access to new products, and loyalty points.',
    channels: ['Email', 'Push Notification', 'SMS'],
  },
  Loyal: {
    icon: '💙', strategy: 'Upsell Campaign', color: '#0ea5e9',
    description: 'Introduce higher-margin products, ask for reviews, and offer early access to sales.',
    channels: ['Email', 'Push Notification'],
  },
  'At-Risk': {
    icon: '⚠️', strategy: 'Win-Back Campaign', color: '#f59e0b',
    description: "Send personalised discount codes and remind them of products they viewed but didn't buy.",
    channels: ['Email', 'Retargeting Ads'],
  },
  Lost: {
    icon: '❌', strategy: 'Re-engagement Campaign', color: '#f43f5e',
    description: 'Last-chance offers, exit surveys, or sunset emails to understand why they left.',
    channels: ['Email'],
  },
}

const cardCls = "rounded-2xl p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm"

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 shadow-lg text-sm">
      <p className="font-bold text-gray-800 dark:text-white">{payload[0]?.payload?.name}</p>
      <p style={{ color: SEGMENT_COLORS[payload[0]?.payload?.name] }}>{payload[0].value?.toLocaleString()} customers</p>
    </div>
  )
  return null
}

function Marketer() {
  const [productName,     setProductName]     = useState('')
  const [recommendations, setRecommendations] = useState(null)
  const [recLoading,      setRecLoading]      = useState(false)
  const [recError,        setRecError]        = useState(null)
  const [allProducts,     setAllProducts]     = useState([])
  const [summary,         setSummary]         = useState(null)
  const [activeStrategy,  setActiveStrategy]  = useState('At-Risk')

  useEffect(() => {
    axios.get(`${API}/recommend/basket`).then(res => setAllProducts(res.data.products || [])).catch(() => {})
    axios.get(`${API}/segments/customers/summary`).then(res => setSummary(res.data)).catch(() => {})
  }, [])

  const getRecommendations = async () => {
    if (!productName.trim()) return
    setRecLoading(true); setRecommendations(null); setRecError(null)
    try {
      const res = await axios.get(`${API}/recommend/basket/${encodeURIComponent(productName)}?top_n=5`)
      setRecommendations(res.data)
    } catch { setRecError(`No rules found for "${productName}". Try a different product.`) }
    setRecLoading(false)
  }

  const chartData = summary
    ? Object.entries(summary.segments).map(([name, data]) => ({ name, count: data.count, percentage: data.percentage }))
    : []

  const suggestedProducts = [
    'JUMBO BAG RED RETROSPOT',
    'LUNCH BAG RED RETROSPOT',
    'ALARM CLOCK BAKELIKE RED',
    'PINK REGENCY TEACUP AND SAUCER',
    'GREEN REGENCY TEACUP AND SAUCER',
  ]

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">📣 Marketer Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          Apriori Recommendations + Customer Segment Campaigns
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Basket Recommender */}
        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">🔗 Basket Recommender</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
            Enter a product to see what customers frequently buy with it — powered by Apriori association rules.
          </p>

          <div className="flex gap-2">
            <input type="text" value={productName}
              onChange={e => setProductName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && getRecommendations()}
              placeholder="e.g. JUMBO BAG RED RETROSPOT"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all
                bg-gray-50 dark:bg-white/5
                border border-gray-200 dark:border-white/10
                text-gray-900 dark:text-white
                placeholder-gray-400 dark:placeholder-slate-600
                focus:border-emerald-400 dark:focus:border-emerald-500"
            />
            <button onClick={getRecommendations} disabled={recLoading || !productName.trim()}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40
                bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-md">
              {recLoading ? '⏳' : '🔍'}
            </button>
          </div>

          <div className="mt-3">
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Try these:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedProducts.map(p => (
                <button key={p} onClick={() => setProductName(p)}
                  className="text-xs px-2.5 py-1 rounded-lg truncate max-w-xs transition-colors
                    bg-gray-100 dark:bg-white/5
                    text-gray-600 dark:text-slate-300
                    border border-gray-200 dark:border-white/10
                    hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400">
                  {p}
                </button>
              ))}
            </div>
          </div>

          {recError && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{recError}</p>
            </div>
          )}

          {recommendations && (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Customers who buy <span className="text-emerald-600 dark:text-emerald-400 font-bold">"{recommendations.product}"</span> also buy:
              </p>
              {recommendations.recommendations.map((rec, i) => (
                <div key={i} className="p-3 rounded-xl border-l-2 bg-emerald-50 dark:bg-emerald-900/10" style={{ borderLeftColor: '#10b981' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                          #{rec.rank}
                        </span>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">{rec.recommended_product}</p>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{rec.interpretation}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        Lift: {rec.lift}
                      </span>
                      <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">
                        Conf: {(rec.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campaign Strategies */}
        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">🎯 Campaign Strategies by Segment</h2>

          <div className="flex gap-2 mb-5 flex-wrap">
            {Object.keys(CAMPAIGN_STRATEGIES).map(seg => (
              <button key={seg} onClick={() => setActiveStrategy(seg)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  backgroundColor: activeStrategy === seg ? SEGMENT_COLORS[seg] : 'transparent',
                  color: activeStrategy === seg ? '#fff' : SEGMENT_COLORS[seg],
                  border: `1px solid ${SEGMENT_COLORS[seg]}`,
                }}>
                {SEGMENT_ICONS[seg]} {seg}
              </button>
            ))}
          </div>

          {(() => {
            const s = CAMPAIGN_STRATEGIES[activeStrategy]
            const segData = summary?.segments[activeStrategy]
            return (
              <div className="p-5 rounded-2xl border"
                   style={{ borderColor: s.color + '40', backgroundColor: s.color + '0d' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl"
                        style={{ background: s.color + '18', border: `1px solid ${s.color}30` }}>
                    {s.icon}
                  </span>
                  <div>
                    <p className="font-bold text-base" style={{ color: s.color }}>{s.strategy}</p>
                    {segData && (
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-slate-400">
                        Target: {segData.count.toLocaleString()} customers ({segData.percentage}%)
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm mb-4 text-gray-600 dark:text-slate-300">{s.description}</p>

                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-2 text-gray-400 dark:text-slate-500">
                    Recommended Channels
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {s.channels.map(channel => (
                      <span key={channel} className="px-3 py-1 rounded-lg text-xs font-semibold"
                            style={{ background: s.color + '18', color: s.color, border: `1px solid ${s.color}30` }}>
                        {channel}
                      </span>
                    ))}
                  </div>
                </div>

                {segData && (
                  <div className="mt-4 p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                    <p className="text-xs font-bold tracking-widest uppercase mb-1 text-gray-400 dark:text-slate-500">💡 Action</p>
                    <p className="text-sm text-gray-700 dark:text-slate-200">{segData.action}</p>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Audience Breakdown */}
      {summary && (
        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">📊 Audience Breakdown for Campaign Planning</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
            Total addressable audience: {summary.total_customers.toLocaleString()} customers
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={SEGMENT_COLORS[entry.name] || '#888'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-4 flex flex-col justify-center">
              {Object.entries(summary.segments).map(([seg, data]) => (
                <div key={seg} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{SEGMENT_ICONS[seg]}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-semibold" style={{ color: SEGMENT_COLORS[seg] }}>{seg}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {data.count.toLocaleString()} ({data.percentage}%)
                      </span>
                    </div>
                    <div className="w-full rounded-full h-1.5 bg-gray-100 dark:bg-white/10">
                      <div className="h-1.5 rounded-full transition-all duration-700"
                           style={{ width: `${data.percentage}%`, backgroundColor: SEGMENT_COLORS[seg] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Available Products */}
      <div className={cardCls}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">📋 Products with Association Rules</h2>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
          {allProducts.length} products have association rules — click any to get recommendations
        </p>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {allProducts.map((p, i) => (
            <button key={i} onClick={() => setProductName(p)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all
                bg-gray-100 dark:bg-white/5
                text-gray-600 dark:text-slate-300
                border border-gray-200 dark:border-white/10
                hover:bg-emerald-50 dark:hover:bg-emerald-900/20
                hover:text-emerald-600 dark:hover:text-emerald-400
                hover:border-emerald-200 dark:hover:border-emerald-800">
              {p}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}

export default Marketer
