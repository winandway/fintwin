import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';
import { useI18n } from '../lib/i18n';

/** Toda contraseña y todo PIN pasan por aquí: arrancan ocultos y llevan el ojito. */
export function CampoClave({
  etiqueta,
  ayuda,
  pin = false,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string; pin?: boolean; error?: boolean }) {
  const [ver, setVer] = useState(false);
  const { t } = useI18n();
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-white">{etiqueta}</span>
      <span className="relative block">
        <input
          {...rest}
          type={ver ? 'text' : 'password'}
          inputMode={pin ? 'numeric' : rest.inputMode}
          maxLength={pin ? 4 : rest.maxLength}
          pattern={pin ? '\\d{4}' : rest.pattern}
          autoComplete={pin ? 'off' : rest.autoComplete}
          aria-invalid={error || undefined}
          className={`w-full rounded-xl border bg-[#0d1528] py-3 pl-4 pr-12 text-white outline-none focus:border-marca ${pin ? 'tracking-[0.5em] font-mono text-lg' : ''} ${error ? 'border-problema' : 'border-borde'}`}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? t('field.hidePassword') : t('field.showPassword')}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-tenue hover:text-white"
        >
          {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </span>
      {ayuda && <span className="block text-xs text-tenue">{ayuda}</span>}
    </label>
  );
}
