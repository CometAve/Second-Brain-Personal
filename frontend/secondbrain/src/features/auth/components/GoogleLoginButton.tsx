import { useState } from 'react';
import { env } from '@/config/env';

type GoogleLoginButtonText = 'signin' | 'signup' | 'continue';

interface GoogleLoginButtonProps {
  text?: GoogleLoginButtonText;
}

const GOOGLE_LOGIN_BUTTON_LABELS = {
  signin: 'Sign in with Google',
  signup: 'Sign up with Google',
  continue: 'Continue with Google',
} as const satisfies Record<GoogleLoginButtonText, string>;

/**
 * Google Login Button Component
 * Follows official Google Sign-In Branding Guidelines
 * https://developers.google.com/identity/branding-guidelines
 *
 * Glassmorphism Design (2024-2025 Trend):
 * - Frosted glass effect with backdrop blur
 * - Semi-transparent background
 * - Subtle border for depth
 * - Smooth hover/press interactions
 *
 * Redirects user to backend OAuth2 endpoint for Google login
 */
export function GoogleLoginButton({ text = 'signin' }: GoogleLoginButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  function handleLogin() {
    window.location.href = env.oauth2LoginUrl;
  }

  // Glassmorphism styles
  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    minWidth: '200px',
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    // Glassmorphism: semi-transparent background
    background: isPressed
      ? 'rgba(255, 255, 255, 0.08)'
      : isHovered
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(255, 255, 255, 0.1)',
    // Frosted glass effect
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    // Subtle border for depth
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '20px',
    color: '#FFFFFF',
    // Smooth transitions
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    // Transform for press feedback
    transform: isPressed ? 'scale(0.98)' : 'scale(1)',
    // Subtle shadow for depth
    boxShadow: isPressed
      ? 'none'
      : isHovered
        ? '0 8px 32px rgba(0, 0, 0, 0.3)'
        : '0 4px 16px rgba(0, 0, 0, 0.2)',
    // Remove focus outline (accessibility maintained via other means)
    outline: 'none',
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
      onClick={handleLogin}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      type="button"
      aria-label={GOOGLE_LOGIN_BUTTON_LABELS[text]}
      style={buttonStyle}
    >
      {/* Google "G" Logo - Official SVG with standard colors */}
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

      {/* Button Text */}
      <span style={{ fontWeight: 500 }}>{GOOGLE_LOGIN_BUTTON_LABELS[text]}</span>
    </button>
  );
}
