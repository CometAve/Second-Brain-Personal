/**
 * Google Login Button - Extension Version
 * Shadow DOM 환경 최적화 (inline styles only)
 * Google Sign-In Branding Guidelines 준수
 * https://developers.google.com/identity/branding-guidelines
 */

import { useState, use } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';
import { useExtensionAuth } from '@/hooks/useExtensionAuth';

interface GoogleLoginButtonProps {
  text?: 'signin' | 'signup' | 'continue';
}

export function GoogleLoginButton({ text = 'signin' }: GoogleLoginButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { resolvedTheme } = use(ThemeContext);
  const { login } = useExtensionAuth();

  const buttonText = {
    signin: 'Sign in with Google',
    signup: 'Sign up with Google',
    continue: 'Continue with Google',
  };

  async function handleLogin() {
    await login();
  }

  // Theme-specific color palettes for Neumorphism
  const lightModeColors = {
    background: '#f0f0f3',
    text: '#1F1F1F',
    shadowDark: 'rgba(0, 0, 0, 0.1)',
    shadowDarkHover: 'rgba(0, 0, 0, 0.15)',
    shadowLight: 'rgba(255, 255, 255, 0.5)',
    shadowLightHover: 'rgba(255, 255, 255, 0.7)',
  };

  const darkModeColors = {
    background: '#2a2a2e',
    text: '#ECEEEF',
    shadowDark: 'rgba(0, 0, 0, 0.4)',
    shadowLight: 'rgba(255, 255, 255, 0.05)',
  };

  const colors = resolvedTheme === 'dark' ? darkModeColors : lightModeColors;

  // Shadow DOM 호환 inline styles with Neumorphism 3D effects (Light & Dark mode support)
  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    minWidth: '200px',
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: colors.background,
    padding: '10px 12px',
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '20px',
    color: colors.text,
    transition: 'box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    // Neumorphism 3D Effect - box-shadow only, no transform
    boxShadow:
      resolvedTheme === 'dark'
        ? isPressed
          ? `inset 4px 4px 8px ${colors.shadowDark}, inset -4px -4px 8px ${colors.shadowLight}`
          : isHovered
            ? `8px 8px 16px ${colors.shadowDark}, -8px -8px 16px ${colors.shadowLight}`
            : `6px 6px 12px ${colors.shadowDark}, -6px -6px 12px ${colors.shadowLight}`
        : isPressed
          ? `inset 4px 4px 8px ${lightModeColors.shadowDarkHover}, inset -4px -4px 8px ${lightModeColors.shadowLightHover}`
          : isHovered
            ? `8px 8px 16px ${lightModeColors.shadowDarkHover}, -8px -8px 16px ${lightModeColors.shadowLightHover}`
            : `6px 6px 12px ${lightModeColors.shadowDark}, -6px -6px 12px ${lightModeColors.shadowLight}`,
  };

  const svgStyle: React.CSSProperties = {
    marginRight: '10px',
    display: 'block',
    flexShrink: 0,
    width: '18px',
    height: '18px',
    minWidth: '18px',
    minHeight: '18px',
  };

  return (
    <button
      onClick={() => void handleLogin()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      type="button"
      aria-label={buttonText[text]}
      style={buttonStyle}
    >
      {/* Google "G" Logo - Official SVG */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        xmlns="http://www.w3.org/2000/svg"
        style={svgStyle}
        aria-hidden="true"
      >
        <path
          d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
          fill="#34A853"
        />
        <path
          d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          fill="#EA4335"
        />
      </svg>

      <span style={{ fontWeight: 500 }}>{buttonText[text]}</span>
    </button>
  );
}
