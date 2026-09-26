import { Key } from 'lucide-react';
import type { Ref } from 'react';

/**
 * ApiKeyMenuItem 컴포넌트 Props
 */
interface ApiKeyMenuItemProps {
  /**
   * 클릭 핸들러 - API Key 관리 뷰로 전환
   */
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * "MCP API Key 관리" 메뉴 아이템 컴포넌트
 * UserProfileMenu에서 사용되며, 클릭 시 API Key 관리 UI로 전환
 *
 * @example
 * <ApiKeyMenuItem onClick={() => setView('apikey-management')} />
 */
export function ApiKeyMenuItem({ onClick, buttonRef }: ApiKeyMenuItemProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // 이벤트 버블링 차단 - Dropdown의 외부 클릭 감지와 충돌 방지
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      ref={buttonRef}
      role="menuitem"
      onClick={handleClick}
      className="flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm text-white transition-colors duration-150 ease-in-out hover:bg-white/10 focus-visible:bg-white/8 motion-reduce:transition-none"
    >
      <Key className="size-4 shrink-0" />
      <span>MCP API Key 관리</span>
    </button>
  );
}
