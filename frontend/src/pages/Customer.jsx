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

const cardCls = "rounded-2xl p-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm"

function InputField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold tracking-wider uppercase mb-1.5 text-gray-500 dark:text-slate-400">
        {label}
      </label>
      <input
        type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all
          bg-gray-50 dark:bg-white/5
          border border-gray-200 dark:border-white/10
          text-gray-900 dark:text-white
          placeholder-gray-400 dark:placeholder-slate-600
          focus:border-blue-400 dark:focus:border-sky-500"
      />
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 shadow-lg text-sm">
      <p className="font-bold text-gray-800 dark:text-white">{payload[0]?.payload?.name}</p>
      <p style={{ color: SEGMENT_COLORS[payload[0]?.payload?.name] }}>{payload[0].value?.toLocaleString()} customers</p>
    </div>
  )
  return null
}

function Customer() {
  const [recency,      setRecency]      = useState(30)
  const [frequency,    setFrequency]    = useState(5)
  const [monetary,     setMonetary]     = useState(500)
  const [result,       setResult]       = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [customerId,   setCustomerId]   = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupLoading,setLookupLoading]= useState(false)
  const [lookupError,  setLookupError]  = useState(null)
  const [summary,      setSummary]      = useState(null)

  useEffect(() => {
  const fetchData = () => {
    axios.get(`${API}/segments/customers/summary`)
      .then(res => setSummary(res.data))
      .catch(() => {})
  }
  fetchData()
  const interval = setInterval(fetchData, 30000)
  return () => clearInterval(interval)
}, [])

  const classifyCustomer = async () => {
    setLoading(true); setResult(null)
    try {
      const res = await axios.post(`${API}/segment/customer`, {
        recency: parseInt(recency), frequency: parseInt(frequency), monetary: parseFloat(monetary),
      })
      setResult(res.data)
    } catch { setResult({ error: 'API error. Make sure FastAPI is running.' }) }
    setLoading(false)
  }

  const lookupCustomer = async () => {
    setLookupLoading(true); setLookupResult(null); setLookupError(null)
    try {
      const res = await axios.get(`${API}/segment/customer/${customerId}`)
      setLookupResult(res.data)
    } catch { setLookupError(`Customer ID "${customerId}" not found.`) }
    setLookupLoading(false)
  }

  const chartData = summary
    ? Object.entries(summary.segments).map(([name, data]) => ({ name, count: data.count, percentage: data.percentage }))
    : []

  const ResultCard = ({ seg, description, action, extra }) => (
    <div className="mt-5 p-4 rounded-xl border-2"
         style={{ borderColor: SEGMENT_COLORS[seg] + '60', backgroundColor: SEGMENT_COLORS[seg] + '10' }}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-3xl">{SEGMENT_ICONS[seg]}</span>
        <div>
          {extra && <p className="text-xs text-gray-500 dark:text-slate-400">{extra}</p>}
          <p className="text-2xl font-black tracking-tight" style={{ color: SEGMENT_COLORS[seg] }}>{seg}</p>
        </div>
      </div>
      {description && <p className="text-sm mt-2 text-gray-600 dark:text-slate-300">{description}</p>}
      <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-white/5">
        <p className="text-xs font-bold tracking-widest uppercase mb-1 text-gray-400 dark:text-slate-500">💡 Recommended Action</p>
        <p className="text-sm text-gray-700 dark:text-slate-200">{action}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">🛍️ Customer Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          K-Means RFM Segmentation — Classify and explore customer segments
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* RFM Classifier */}
        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">🎯 Classify a Customer</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
            Enter RFM values to predict which segment a customer belongs to.
          </p>
          <div className="space-y-4">
            <InputField label="Recency (days since last purchase)" value={recency} onChange={setRecency} placeholder="e.g. 30" />
            <InputField label="Frequency (number of orders)" value={frequency} onChange={setFrequency} placeholder="e.g. 5" />
            <InputField label="Monetary (total spend £)" value={monetary} onChange={setMonetary} placeholder="e.g. 500" />
            <button onClick={classifyCustomer} disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-40
                bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md">
              {loading ? '⏳ Classifying…' : '🔍 Classify Customer'}
            </button>
          </div>
          {result && !result.error && (
            <ResultCard seg={result.segment} description={result.segment_description}
              action={result.marketing_action} extra="Predicted Segment" />
          )}
          {result?.error && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
            </div>
          )}
        </div>

        {/* Customer Lookup */}
        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">🔎 Look Up Existing Customer</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
            Enter a Customer ID to see their pre-computed segment.
          </p>
          <div className="flex gap-2">
            <input type="text" value={customerId} onChange={e => setCustomerId(e.target.value)}
              placeholder="e.g. 12747"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all
                bg-gray-50 dark:bg-white/5
                border border-gray-200 dark:border-white/10
                text-gray-900 dark:text-white
                placeholder-gray-400 dark:placeholder-slate-600
                focus:border-blue-400 dark:focus:border-sky-500"
            />
            <button onClick={lookupCustomer} disabled={lookupLoading || !customerId}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40
                bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
              {lookupLoading ? '⏳' : '🔍'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {['12747', '12583', '13047', '14096'].map(id => (
              <button key={id} onClick={() => setCustomerId(id)}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors
                  bg-gray-100 dark:bg-white/5
                  text-gray-600 dark:text-slate-300
                  border border-gray-200 dark:border-white/10
                  hover:bg-blue-50 dark:hover:bg-sky-900/20 hover:text-blue-600 dark:hover:text-sky-400">
                Try {id}
              </button>
            ))}
          </div>

          {lookupResult && (
            <div className="mt-4 p-4 rounded-xl border-2"
                 style={{ borderColor: SEGMENT_COLORS[lookupResult.segment] + '60', backgroundColor: SEGMENT_COLORS[lookupResult.segment] + '10' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{SEGMENT_ICONS[lookupResult.segment]}</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Customer {lookupResult.customer_id}</p>
                  <p className="text-xl font-black" style={{ color: SEGMENT_COLORS[lookupResult.segment] }}>{lookupResult.segment}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Recency', value: `${lookupResult.recency}d` },
                  { label: 'Frequency', value: lookupResult.frequency },
                  { label: 'Monetary', value: `£${lookupResult.monetary?.toLocaleString()}` },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl p-3 text-center bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10">
                    <p className="text-xs text-gray-400 dark:text-slate-500">{stat.label}</p>
                    <p className="font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm mt-3 text-gray-600 dark:text-slate-300">{lookupResult.marketing_action}</p>
            </div>
          )}
          {lookupError && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{lookupError}</p>
            </div>
          )}

          {/* Segment Guide */}
          <div className="mt-6">
            <p className="text-xs font-bold tracking-widest uppercase mb-3 text-gray-400 dark:text-slate-500">Segment Guide</p>
            <div className="space-y-2.5">
              {Object.entries(SEGMENT_COLORS).map(([seg, color]) => (
                <div key={seg} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-semibold" style={{ color }}>{seg}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">
                    {seg === 'Champions' && 'Recent, frequent, high spend'}
                    {seg === 'Loyal'     && 'Regular buyer, decent spend'}
                    {seg === 'At-Risk'  && "Hasn't bought recently"}
                    {seg === 'Lost'     && 'Long time inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Segment Distribution Chart */}
      {summary && (
        <div className={cardCls}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">📊 Customer Segment Distribution</h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
            Total: {summary.total_customers.toLocaleString()} customers
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" className="dark:stroke-white/5" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 13 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={SEGMENT_COLORS[entry.name] || '#888'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {Object.entries(summary.segments).map(([seg, data]) => (
              <div key={seg} className="rounded-xl p-4 text-center border"
                   style={{ borderColor: SEGMENT_COLORS[seg] + '40', backgroundColor: SEGMENT_COLORS[seg] + '10' }}>
                <p className="text-2xl mb-1">{SEGMENT_ICONS[seg]}</p>
                <p className="font-bold text-sm" style={{ color: SEGMENT_COLORS[seg] }}>{seg}</p>
                <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">{data.count.toLocaleString()}</p>
                <p className="text-xs mt-0.5 text-gray-500 dark:text-slate-400">{data.percentage}%</p>
                <p className="text-xs mt-2 text-gray-400 dark:text-slate-500">{data.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

export default Customer
