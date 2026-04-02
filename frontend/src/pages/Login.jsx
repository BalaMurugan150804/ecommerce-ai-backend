import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

const API = 'http://127.0.0.1:8000'

function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password })
      const { token, user } = res.data

      // Save token and user info to localStorage
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      // Redirect based on role
      const routes = {
        admin:    '/',
        seller:   '/seller',
        marketer: '/marketer',
        customer: '/customer',
      }
      navigate(routes[user.role] || '/')

    } catch (e) {
      setError(e.response?.data?.detail || 'Login failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🛒</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            E-Commerce AI
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Sign in to your dashboard
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            {loading ? '⏳ Signing in...' : '🔑 Sign In'}
          </button>
        </div>

        {/* Role guide */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Role → Dashboard
          </p>
          <div className="space-y-1">
            {[
              { role: 'admin',    icon: '⚙️', desc: 'Full access + admin panel' },
              { role: 'seller',   icon: '📦', desc: 'Product insights' },
              { role: 'marketer', icon: '📣', desc: 'Campaign & recommendations' },
              { role: 'customer', icon: '🛍️', desc: 'Personalised shopping' },
            ].map(r => (
              <div key={r.role} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{r.icon}</span>
                <span className="font-medium capitalize">{r.role}</span>
                <span>→ {r.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:underline font-medium">
            Register here
          </Link>
        </p>

      </div>
    </div>
  )
}

export default Login
