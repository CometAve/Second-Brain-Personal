/**
 * iOS 스타일 토글 스위치 컴포넌트
 * - On: 초록색 배경 + 노브 오른쪽
 * - Off: 흰색 반투명 배경 + 노브 왼쪽
 * - 부드러운 애니메이션 전환
 * - 접근성: role="switch", aria-checked
 */

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 ease-in-out motion-reduce:transition-none ${
        checked ? 'bg-green-500' : 'bg-white/30'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform duration-200 ease-in-out motion-reduce:transition-none ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
