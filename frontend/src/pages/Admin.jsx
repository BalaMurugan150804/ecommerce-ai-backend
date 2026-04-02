import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = 'https://ecommerce-ai-backend-mj6s.onrender.com'
const ROLE_COLORS = {
  admin:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  seller:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  marketer: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  customer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const ROLE_ICONS = {
  admin:    '⚙️',
  seller:   '📦',
  marketer: '📣',
  customer: '🛍️',
}

function StatCard({ icon, title, value, subtitle, color }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow border-l-4`}
         style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  )
}

function Admin() {
  const navigate  = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('all')

  const user  = JSON.parse(localStorage.getItem('user')  || 'null')
  const token = localStorage.getItem('token')

  useEffect(() => {
  if (!user || user.role !== 'admin') {
    navigate('/')
    return
  }
  fetchStats()
  const interval = setInterval(fetchStats, 30000)
  return () => clearInterval(interval)
}, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API}/admin/stats?token=${token}`)
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load admin data.')
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-500 dark:text-gray-400">Loading admin panel...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-6 text-center">
      <div className="text-4xl mb-3">⛔</div>
      <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
    </div>
  )

  // Filter + search users
  const filteredUsers = (data?.users || []).filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || u.role === filter
    return matchSearch && matchFilter
  })

  // Role counts
  const roleCounts = (data?.users || []).reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            ⚙️ Admin Panel
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            System overview · User management · Model status
          </p>
        </div>
        <button onClick={fetchStats}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          🔄 Refresh
        </button>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="👥" title="Total Users"     value={data.total_users}                        subtitle="Registered accounts"     color="#0ea5e9" />
        <StatCard icon="🛍️" title="Customers"       value={data.system.customers_loaded.toLocaleString()} subtitle="Segmented by K-Means"    color="#10b981" />
        <StatCard icon="📦" title="Products"         value={data.system.products_loaded.toLocaleString()}  subtitle="Clustered by K-Means"   color="#8b5cf6" />
        <StatCard icon="🔗" title="Rules"            value={data.system.rules_loaded}                subtitle="Apriori association rules" color="#f59e0b" />
      </div>

      {/* ML Model Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
          🤖 ML Model Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(data.system.models).map(([model, status]) => (
            <div key={model} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white capitalize">
                  {model.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Ready to serve predictions</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Role Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
          👥 Users by Role
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['admin', 'seller', 'marketer', 'customer'].map(role => (
            <div key={role} className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${
              filter === role ? 'border-blue-500 scale-105' : 'border-gray-200 dark:border-gray-700'
            }`}
            onClick={() => setFilter(filter === role ? 'all' : role)}>
              <div className="text-2xl mb-1">{ROLE_ICONS[role]}</div>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                {roleCounts[role] || 0}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role]}`}>
                {role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            📋 Registered Users ({filteredUsers.length})
          </h2>
          <div className="flex gap-3 flex-wrap">
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
            {/* Filter */}
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="seller">Seller</option>
              <option value="marketer">Marketer</option>
              <option value="customer">Customer</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['ID', 'Name', 'Email', 'Role', 'Status', 'Joined'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium uppercase text-xs">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, i) => (
                  <tr key={u.id}
                    className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      i % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-700/20' : ''
                    }`}>
                    <td className="py-3 px-3 text-gray-400">#{u.id}</td>
                    <td className="py-3 px-3 font-medium text-gray-800 dark:text-white">{u.name}</td>
                    <td className="py-3 px-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                        {ROLE_ICONS[u.role]} {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        u.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {u.is_active ? '✅ Active' : '❌ Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-400 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

export default Admin
