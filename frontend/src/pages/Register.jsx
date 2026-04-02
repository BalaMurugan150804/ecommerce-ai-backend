import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

const API = 'https://ecommerce-ai-backend-mj6s.onrender.com'

function Register() {
  const navigate  = useNavigate()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState('customer')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const handleRegister = async () => {
    setLoading(true)
    setError(null)

    if (!name || !email || !password) {
      setError('Please fill in all fields.')
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    try {
      const res = await axios.post(`${API}/auth/register`, {
        name, email, password, role
      })
      const { token, user } = res.data

      // Save to localStorage
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
      setError(e.response?.data?.detail || 'Registration failed. Please try again.')
    }
    setLoading(false)
  }

  const roles = [
    { value: 'customer',  label: 'Customer',  icon: '🛍️', desc: 'Browse & get recommendations' },
    { value: 'seller',    label: 'Seller',    icon: '📦', desc: 'Manage products & insights' },
    { value: 'marketer',  label: 'Marketer',  icon: '📣', desc: 'Campaigns & analytics' },
    { value: 'admin',     label: 'Admin',     icon: '⚙️', desc: 'Full system access' },
  ]

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🛒</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Create Account
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Join the E-Commerce AI platform
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
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
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
              placeholder="Min. 6 characters"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Your Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className="p-3 rounded-lg border-2 text-left transition-all duration-200"
                  style={{
                    borderColor: role === r.value ? '#2563EB' : 'transparent',
                    backgroundColor: role === r.value ? '#EFF6FF' : '#F9FAFB',
                  }}
                >
                  <div className="text-lg mb-1">{r.icon}</div>
                  <div className="text-xs font-bold text-gray-800">{r.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={loading || !name || !email || !password}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            {loading ? '⏳ Creating account...' : '🚀 Create Account'}
          </button>
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Sign in here
          </Link>
        </p>

      </div>
    </div>
  )
}

export default Register
