import { useEffect, useState } from 'react';

const STORAGE_KEY = 'admin_passcode_ok';

export function useAdminPasscode(): {
  authorized: boolean;
  passcodeInput: string;
  setPasscodeInput: (v: string) => void;
  submit: () => void;
  error: string | null;
} {
  const expected = import.meta.env.VITE_ADMIN_PASSCODE ?? '';
  const [authorized, setAuthorized] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === '1',
  );
  const [passcodeInput, setPasscodeInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expected) {
      setAuthorized(true);
    }
  }, [expected]);

  function submit() {
    if (!expected || passcodeInput === expected) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      setAuthorized(true);
      setError(null);
      return;
    }
    setError('パスコードが正しくありません');
  }

  return { authorized, passcodeInput, setPasscodeInput, submit, error };
}
