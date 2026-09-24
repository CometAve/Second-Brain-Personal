import { useEffect, useState } from 'react';
import { Settings, Plus, X, ChevronLeft } from 'lucide-react';
import { Button } from '@/content-scripts/overlay/components/ui/button';
import type { DragSearchSettings } from '@/types/dragSearch';
import browser from 'webextension-polyfill';

interface DragSearchSettingsPanelProps {
  onClose?: () => void;
}

/**
 * 드래그 검색 설정 패널
 * 자동 검색 On/Off, 최소 텍스트 길이, 제외 도메인 관리
 */
export function DragSearchSettingsPanel({ onClose }: DragSearchSettingsPanelProps) {
  const [settings, setSettings] = useState<DragSearchSettings>({
    enabled: true,
    minTextLength: 2,
    debounceMs: 300,
    autoHideMs: 3000,
    excludedDomains: [],
  });

  const [newDomain, setNewDomain] = useState('');

  // 설정 로드
  useEffect(() => {
    void browser.storage.local.get(['dragSearchSettings']).then((result) => {
      if (result.dragSearchSettings) {
        setSettings(result.dragSearchSettings as DragSearchSettings);
      }
    });
  }, []);

  // 설정 변경 핸들러
  const handleSettingChange = async <K extends keyof DragSearchSettings>(
    key: K,
    value: DragSearchSettings[K],
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await browser.storage.local.set({ dragSearchSettings: newSettings });
    // storage.onChanged 이벤트가 자동으로 DragSearchManager에 전달됨
  };

  // 도메인 추가
  const handleAddDomain = () => {
    if (newDomain && !settings.excludedDomains.includes(newDomain)) {
      void handleSettingChange('excludedDomains', [...settings.excludedDomains, newDomain]);
      setNewDomain('');
    }
  };

  // 도메인 제거
  const handleRemoveDomain = (domain: string) => {
    void handleSettingChange(
      'excludedDomains',
      settings.excludedDomains.filter((d) => d !== domain),
    );
  };

  return (
    <div className="w-80 rounded-lg border border-border bg-card p-4 shadow-xl">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Settings className="size-5 text-primary" />
            <h3 className="text-lg font-semibold text-card-foreground">드래그 검색 설정</h3>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              onClick={onClose}
              aria-label="닫기"
            >
              <ChevronLeft className="size-5" />
            </Button>
          )}
        </div>

        {/* 자동 검색 활성화 */}
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="drag-search-enabled" className="font-medium text-foreground">
              자동 검색 활성화
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              텍스트 드래그 시 자동으로 검색 버튼 표시
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => void handleSettingChange('enabled', !settings.enabled)}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
            style={{
              backgroundColor: settings.enabled ? 'rgb(37, 99, 235)' : 'rgb(229, 231, 235)',
            }}
          >
            <span
              className="inline-block size-5 transform rounded-full bg-white transition-transform"
              style={{
                transform: settings.enabled ? 'translateX(22px)' : 'translateX(2px)',
              }}
            />
          </button>
        </div>

        {/* 최소 텍스트 길이 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="min-text-length" className="font-medium text-foreground">
            최소 텍스트 길이
          </label>
          <div className="flex items-center gap-3">
            <input
              id="min-text-length"
              type="number"
              min={1}
              max={10}
              value={settings.minTextLength}
              onChange={(e) => void handleSettingChange('minTextLength', Number(e.target.value))}
              className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none"
            />
            <span className="text-sm text-muted-foreground">
              {settings.minTextLength}자 이상 드래그 시 검색
            </span>
          </div>
        </div>

        {/* 자동 숨김 시간 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="auto-hide-ms" className="font-medium text-foreground">
            검색 버튼 표시 시간 (초)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="auto-hide-ms"
              type="number"
              min={1}
              max={10}
              value={settings.autoHideMs / 1000}
              onChange={(e) =>
                void handleSettingChange('autoHideMs', Number(e.target.value) * 1000)
              }
              className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none"
            />
            <span className="text-sm text-muted-foreground">
              {settings.autoHideMs / 1000}초 후 자동 숨김
            </span>
          </div>
        </div>

        {/* 제외 도메인 */}
        <div className="flex flex-col gap-3">
          <label className="font-medium text-foreground">제외할 웹사이트</label>
          <p className="-mt-2 text-xs text-muted-foreground">
            이 도메인에서는 드래그 검색이 작동하지 않습니다
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none"
            />
            <Button onClick={handleAddDomain} disabled={!newDomain} size="sm" className="gap-1">
              <Plus className="size-4" />
              추가
            </Button>
          </div>

          {settings.excludedDomains.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.excludedDomains.map((domain) => (
                <div
                  key={domain}
                  className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm"
                >
                  <span className="text-foreground">{domain}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-5 p-0 hover:text-destructive"
                    onClick={() => handleRemoveDomain(domain)}
                    aria-label={`${domain} 제거`}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
