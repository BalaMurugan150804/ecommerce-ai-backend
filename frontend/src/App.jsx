import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Customer from './pages/Customer'
import Seller from './pages/Seller'
import Marketer from './pages/Marketer'
import Login from './pages/Login'
import Register from './pages/Register'
import Admin from './pages/Admin'

function App() {
  const [darkMode, setDarkMode] = useState(true)

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        <Router>
          <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
          <div className="max-w-7xl mx-auto px-4 py-8">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<Home />} />
              <Route path="/customer" element={<Customer />} />
              <Route path="/seller" element={<Seller />} />
              <Route path="/marketer" element={<Marketer />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </div>
        </Router>
      </div>
    </div>
  )
}

export default App