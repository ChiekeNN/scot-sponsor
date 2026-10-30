import { useEffect, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
  required?: boolean;
};

/** Passwords are hidden by default; visibility is controlled only on this device. */
export function PasswordField({ label = 'Password', value, onChange, autoComplete, minLength, required }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  // Don't carry a visible password over when switching between sign-in and sign-up.
  useEffect(() => { setVisible(false); }, [autoComplete]);

  return <div className="password-field">
    <label htmlFor={id}>{label}</label>
    <div className="password-input-wrap">
      <input id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} required={required} value={value} onChange={event => onChange(event.target.value)} />
      <button className="password-visibility" type="button" aria-controls={id} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(current => !current)}>
        {visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
      </button>
    </div>
  </div>;
}
