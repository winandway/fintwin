import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Cargando } from './components/ui';
import { I18nProvider } from './lib/i18n';
import { SesionProvider, useSesion } from './lib/sesion';
import { Account } from './pages/Account';
import { Confirm, Forgot, Login, Reset, SignUp } from './pages/Auth';
import { PayLink, Team } from './pages/Equipo';
import { Home, NewAccount } from './pages/Home';
import { DeleteAccount, Invite, Landing, NotFound, Pay } from './pages/Publicas';

function ConSesion({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useSesion();
  const location = useLocation();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

function SinSesion({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useSesion();
  if (cargando) return <Cargando />;
  if (usuario) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

export function Rutas() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SinSesion><Landing /></SinSesion>} />
        <Route path="/signup" element={<SinSesion><SignUp /></SinSesion>} />
        <Route path="/login" element={<SinSesion><Login /></SinSesion>} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/confirm" element={<Confirm />} />
        <Route path="/pay/:slug" element={<Pay />} />
        <Route path="/invite/:token" element={<Invite />} />
        <Route path="/delete-account" element={<DeleteAccount />} />
        <Route path="/home" element={<ConSesion><Home /></ConSesion>} />
        <Route path="/accounts/new" element={<ConSesion><NewAccount /></ConSesion>} />
        <Route path="/accounts/:id" element={<ConSesion><Account /></ConSesion>} />
        <Route path="/accounts/:id/link" element={<ConSesion><PayLink /></ConSesion>} />
        <Route path="/accounts/:id/team" element={<ConSesion><Team /></ConSesion>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export function App() {
  return (
    <I18nProvider>
      <SesionProvider>
        <BrowserRouter>
          <Rutas />
        </BrowserRouter>
      </SesionProvider>
    </I18nProvider>
  );
}
