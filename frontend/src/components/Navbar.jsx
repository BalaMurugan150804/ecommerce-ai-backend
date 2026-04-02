import { Link, useLocation, useNavigate } from 'react-router-dom'

function Navbar({ darkMode, setDarkMode }) {
  const location = useLocation()
  const navigate  = useNavigate()

  const user = JSON.parse(localStorage.getItem('user') || 'null')

  const links = [
    { path: '/',          label: '🏠 Home' },
    { path: '/customer',  label: '🛍️ Customer' },
    { path: '/seller',    label: '📦 Seller' },
    { path: '/marketer',  label: '📣 Marketer' },
    { path: '/admin', label: '⚙️ Admin' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const roleColors = {
    admin:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    seller:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    marketer: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    customer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  }

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛒</span>
          <span className="font-bold text-gray-800 dark:text-white text-lg">
            E-Commerce AI
          </span>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-2">
          {links.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${location.pathname === link.path
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>

          {/* User info */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-800 dark:text-white leading-tight">
                  {user.name}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[user.role] || ''}`}>
                  {user.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all duration-200"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200"
            >
              Login
            </Link>
          )}

        </div>
      </div>
    </nav>
  )
}

export default Navbar
