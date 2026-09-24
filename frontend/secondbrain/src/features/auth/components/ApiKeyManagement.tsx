import { useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useGenerateApiKey } from '@/features/auth/hooks/useGenerateApiKey';
import { useApiKeyVisibility } from '@/features/auth/hooks/useApiKeyVisibility';

/**
 * API Key 관리 컴포넌트
 * - API Key 발급/재발급
 * - API Key 표시/숨김 (마스킹)
 * - API Key 클립보드 복사
 *
 * @example
 * <ApiKeyManagement />
 */
export function ApiKeyManagement() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const { isVisible, toggle } = useApiKeyVisibility();

  const { mutate: generate, isPending: isGenerating } = useGenerateApiKey();

  /**
   * API Key 발급 핸들러
   */
  const handleGenerate = () => {
    generate(undefined, {
      onSuccess: (key) => setApiKey(key),
    });
  };

  /**
   * API Key 클립보드 복사 핸들러
   */
  const handleCopy = async () => {
    if (!apiKey) return;

    try {
      await navigator.clipboard.writeText(apiKey);
      toast.success('API Key가 클립보드에 복사되었습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  /**
   * 표시할 값 계산
   * - API Key가 있고 isVisible이 true면 실제 키 표시
   * - API Key가 있고 isVisible이 false면 마스킹 처리 (●●●...)
   * - API Key가 없으면 플레이스홀더 표시
   */
  const displayValue = apiKey ? (isVisible ? apiKey : '●'.repeat(36)) : '';

  return (
    <div className="flex flex-col gap-4">
      {/* 제목 */}
      <h3 className="text-sm font-semibold text-white">MCP API Key 관리</h3>

      {/* 안내 문구 */}
      <p className="text-xs text-white/60">
        MCP 클라이언트 연동을 위한 API Key를 발급받으세요.
        <br />
        발급된 키는 재발급 시 기존 키가 무효화됩니다.
      </p>

      {/* API Key 표시 영역 + 발급 버튼 - 가로 배치 */}
      <div className="flex gap-2">
        {/* 발급 버튼 */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleGenerate();
          }}
          disabled={isGenerating}
          variant="primary"
          size="sm"
        >
          {apiKey ? '재발급' : '발급'}
        </Button>

        {/* API Key Input 영역 */}
        <div className="flex flex-1 gap-1">
          <Input
            readOnly
            value={displayValue}
            placeholder="API Key가 여기에 표시됩니다"
            className="flex-1 font-mono text-xs"
          />

          {/* 표시/숨김 토글 버튼 */}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            variant="ghost"
            size="icon"
            title={isVisible ? '숨기기' : '표시'}
            disabled={!apiKey}
          >
            {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>

          {/* 복사 버튼 */}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy();
            }}
            variant="ghost"
            size="icon"
            title="복사"
            disabled={!apiKey}
          >
            <Copy className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
