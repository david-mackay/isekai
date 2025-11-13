"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DEFAULT_MODEL_ID, resolveModelId } from "@/lib/modelOptions";

type DevSettingsContextValue = {
  modelId: string;
  setModelId: (modelId: string) => void;
};

const STORAGE_KEY = "isekai:modelPreference";

const DevSettingsContext = createContext<DevSettingsContextValue | undefined>(
  undefined
);

export function DevSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modelId, setModelIdState] = useState(DEFAULT_MODEL_ID);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setModelIdState(resolveModelId(stored));
    }
  }, []);

  const setModelId = useCallback((next: string) => {
    const resolved = resolveModelId(next);
    setModelIdState(resolved);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, modelId);
  }, [modelId]);

  const value = useMemo(
    () => ({
      modelId,
      setModelId,
    }),
    [modelId, setModelId]
  );

  return (
    <DevSettingsContext.Provider value={value}>
      {children}
    </DevSettingsContext.Provider>
  );
}

export function useDevSettings() {
  const context = useContext(DevSettingsContext);
  if (!context) {
    throw new Error("useDevSettings must be used within a DevSettingsProvider");
  }
  return context;
}
