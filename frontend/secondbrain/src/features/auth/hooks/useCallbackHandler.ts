import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';

export function useCallbackHandler(
  code: string | undefined,
  error: string | undefined,
  exchangeToken: (code: string) => void,
) {
  const navigate = useNavigate();
  const processedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (error) {
      void navigate({ to: '/', search: { error: 'oauth_error' }, replace: true });
      return;
    }
    if (!code) {
      void navigate({ to: '/', search: { error: 'missing_code' }, replace: true });
      return;
    }
    if (processedCodeRef.current === code) return;
    processedCodeRef.current = code;
    exchangeToken(code);
  }, [code, error, exchangeToken, navigate]);
}
