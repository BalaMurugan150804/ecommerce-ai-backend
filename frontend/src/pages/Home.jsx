import { useEffect, useState } from 'react'
import axios from 'axios'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const API = 'https://ecommerce-ai-backend-mj6s.onrender.com'

const SEGMENT_COLORS = {
  Champions: '#10b981',
  Loyal:     '#0ea5e9',
  'At-Risk': '#f59e0b',
  Lost:      '#f43f5e',
}

const PRODUCT_COLORS = {
  Budget:   '#0ea5e9',
  Trending: '#10b981',
  Premium:  '#8b5cf6',
  Niche:    '#f59e0b',
}

function StatCard({ title, value, subtitle, color, icon }) {
  return (
    <div className="relative rounded-2xl p-6 overflow-hidden bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm">
      <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-10 blur-2xl"
           style={{ backgroundColor: color }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 dark:text-slate-400">
            {title}
          </p>
          <p className="text-4xl font-black mt-2 tracking-tight text-gray-900 dark:text-white">{value}</p>
          {subtitle && <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">{subtitle}</p>}
        </div>
        <span className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl"
              style={{ background: color + '18', border: `1px solid ${color}30` }}>
          {icon}
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-50"
           style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 shadow-lg text-sm">
        <p className="font-bold text-gray-800 dark:text-white">{payload[0].name}</p>
        <p style={{ color: payload[0].payload.fill }}>{payload[0].value?.toLocaleString()}</p>
      </div>
    )
  }
  return null
}

function Home() {
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [overview, setOverview] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
  const fetchData = () => {
    axios.get(`${API}/insights/overview`)
      .then(res => {
        setOverview(res.data)
        setLoading(false)
        setLastUpdated(new Date())
      })
      .catch(() => { setError('Cannot connect to API. Make sure FastAPI is running.'); setLoading(false) })
  }

  fetchData()

  // Auto refresh every 30 seconds
  const interval = setInterval(fetchData, 30000)
  return () => clearInterval(interval)
}, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading data from API…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="rounded-2xl p-8 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="font-semibold text-red-600 dark:text-red-400">{error}</p>
      <p className="text-sm text-red-400 dark:text-red-500 mt-2">
        Run: <code className="bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">python main.py</code>
      </p>
    </div>
  )

  const customerChartData = Object.entries(overview.customer_segments).map(([name, data]) => ({
    name, value: data.count
  }))
  const productChartData = Object.entries(overview.product_segments).map(([name, data]) => ({
    name, value: data.count
  }))

  const cardCls = "rounded-2xl p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm"

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          📊 Business Overview
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          AI-powered insights from your e-commerce data

        <p className="text-xs text-gray-400 mt-1">
          🔄 Live data · Last updated: {lastUpdated.toLocaleTimeString()}
        </p>  
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Customers" value={overview.business_metrics.total_customers.toLocaleString()}
          subtitle="Segmented by RFM K-Means" color="#0ea5e9" icon="👥" />
        <StatCard title="Total Products" value={overview.business_metrics.total_products.toLocaleString()}
          subtitle="Clustered by K-Means" color="#10b981" icon="📦" />
        <StatCard title="Total Revenue" value={`£${overview.business_metrics.total_revenue_gbp.toLocaleString()}`}
          subtitle="From all transactions" color="#8b5cf6" icon="💰" />
        <StatCard title="Avg Order Value" value={`£${overview.business_metrics.avg_order_value.toLocaleString()}`}
          subtitle="Per customer" color="#f59e0b" icon="🛒" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">👥 Customer Segments</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">RFM-based K-Means clusters</p>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={customerChartData} cx="50%" cy="50%"
                outerRadius={100} innerRadius={48} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                labelLine={{ stroke: '#9ca3af' }}>
                {customerChartData.map((entry) => (
                  <Cell key={entry.name} fill={SEGMENT_COLORS[entry.name] || '#888'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {customerChartData.map(entry => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[entry.name] }} />
                <span className="text-xs text-gray-500 dark:text-slate-400">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">📦 Product Segments</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">K-Means product clustering</p>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={productChartData} cx="50%" cy="50%"
                outerRadius={100} innerRadius={48} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                labelLine={{ stroke: '#9ca3af' }}>
                {productChartData.map((entry) => (
                  <Cell key={entry.name} fill={PRODUCT_COLORS[entry.name] || '#888'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {productChartData.map(entry => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRODUCT_COLORS[entry.name] }} />
                <span className="text-xs text-gray-500 dark:text-slate-400">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className={cardCls}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">🔗 Top Association Rules</h2>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">Apriori-derived purchase correlations</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/10">
                {['If customer buys', 'Recommend', 'Lift', 'Confidence'].map((h, i) => (
                  <th key={h} className={`py-3 px-4 text-xs font-semibold tracking-wider uppercase text-gray-400 dark:text-slate-500 ${i >= 2 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.top_association_rules.map((rule, i) => (
                <tr key={i} className={`border-b border-gray-50 dark:border-white/5 ${i % 2 === 0 ? 'bg-gray-50/60 dark:bg-white/[0.02]' : ''}`}>
                  <td className="py-3 px-4 font-medium text-blue-600 dark:text-sky-400">{rule.antecedents_str}</td>
                  <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400">{rule.consequents_str}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                      {parseFloat(rule.lift).toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-gray-600 dark:text-slate-300">
                    {(parseFloat(rule.confidence) * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center text-xs pb-4 text-gray-300 dark:text-slate-600">
        E-Commerce AI Recommendation & Business Insights — Final Year Project
      </div>

    </div>
  )
}

export default Home
