import { LifeBuoy, LogOut, Trash2, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MenuPuntos } from '../components/MenuPuntos';
import { Boton, Pagina, Tarjeta } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useSesion } from '../lib/sesion';

/**
 * «Mi perfil». Borrar el usuario vive AQUÍ, lejos de «Cerrar sesión» y escondido en los tres puntos
 * (regla de la casa: lo destructivo nunca suelto ni pegado a otra acción que se toca seguido).
 */
export function Profile() {
  const { t } = useI18n();
  const { usuario, salir } = useSesion();
  const navigate = useNavigate();
  if (!usuario) return null;
  return (
    <Pagina angosta>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('nav.profile')}</h1>
        <MenuPuntos
          opciones={[{ texto: t('nav.deleteUser'), icono: <Trash2 className="h-4 w-4" />, onClick: () => navigate('/delete-account'), peligro: true }]}
        />
      </div>
      <Tarjeta className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10">
          <UserRound className="h-6 w-6 text-tenue" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold" data-testid="perfil-nombre">{usuario.nombre}</p>
          <p className="truncate text-sm text-tenue">{usuario.email ?? t('profile.noEmail')}</p>
        </div>
      </Tarjeta>
      <div className="space-y-2">
        <Link to="/help" className="block">
          <Boton variante="secundario" className="w-full">
            <LifeBuoy className="h-4 w-4" aria-hidden /> {t('nav.help')}
          </Boton>
        </Link>
        <Boton variante="secundario" className="w-full" onClick={() => void salir()}>
          <LogOut className="h-4 w-4" aria-hidden /> {t('nav.signOut')}
        </Boton>
      </div>
      <p className="mt-6 text-center text-xs text-tenue">{t('profile.deleteHint')}</p>
    </Pagina>
  );
}
