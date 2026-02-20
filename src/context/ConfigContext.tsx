// アプリ設定（プロファイル一覧・アクティブプロファイル）を
// React ツリー全体にばらまく Context。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { loadConfig, saveConfig } from "../lib/tauri";
import type { AppConfig, Profile } from "../types/workato";

interface ConfigContextValue {
  config: AppConfig | null;
  activeProfile: Profile | null;
  isLoading: boolean;
  saveProfiles: (profiles: Profile[], activeProfile: string) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

// 設定ファイルが無いときのデフォ
const DEFAULT_CONFIG: AppConfig = {
  profiles: [
    {
      name: "Default",
      api_token: "",
      base_url: "https://app.trial.workato.com",
    },
  ],
  active_profile: "Default",
};

// 起動時に設定ファイル読んで、子コンポーネントに流す Provider
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfig()
      .then((c) => setConfig(c))
      .catch(() => setConfig(DEFAULT_CONFIG))
      .finally(() => setIsLoading(false));
  }, []);

  const activeProfile = useMemo<Profile | null>(() => {
    if (!config) return null;
    return (
      config.profiles.find((p) => p.name === config.active_profile) ?? null
    );
  }, [config]);

  // 保存して state にも反映
  const saveProfiles = useCallback(
    async (profiles: Profile[], active: string) => {
      await saveConfig(profiles, active);
      setConfig({ profiles, active_profile: active });
    },
    [],
  );

  return (
    <ConfigContext.Provider
      value={{ config, activeProfile, isLoading, saveProfiles }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

// ConfigContext から値を取るフック。Provider の外で使うとエラー。
export const useConfig = (): ConfigContextValue => {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return ctx;
};
