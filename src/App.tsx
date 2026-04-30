import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { Home } from './pages/Home';
import { Trending } from './pages/Trending';
import { TokenDetail } from './pages/TokenDetail';
import { CreateToken } from './pages/CreateToken';
import { Profile } from './pages/Profile';
import { Docs } from './pages/Docs';
import { GlobalTradeFeed } from './components/ui/GlobalTradeFeed';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#080808] flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/token/:mint" element={<TokenDetail />} />
            <Route path="/launch/create" element={<CreateToken />} />
            <Route path="/profile/:wallet" element={<Profile />} />
            <Route path="/creator/:wallet" element={<Profile />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/portfolio" element={<Navigate to="/profile" replace />} />
            <Route path="/docs" element={<Docs />} />
          </Routes>
        </main>
        <Footer />
        <GlobalTradeFeed />
      </div>
    </BrowserRouter>
  );
}
