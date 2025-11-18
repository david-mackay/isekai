"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  resolveModelId,
  resolveImageModelId,
} from "@/lib/modelOptions";

type DevSettingsContextValue = {
  modelId: string;
  setModelId: (modelId: string) => void;
  imageModelId: string;
  setImageModelId: (modelId: string) => void;
};

const STORAGE_KEY = "isekai:modelPreference";
const IMAGE_STORAGE_KEY = "isekai:imageModelPreference";

const DevSettingsContext = createContext<DevSettingsContextValue | undefined>(
  undefined
);

export function DevSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modelId, setModelIdState] = useState(DEFAULT_MODEL_ID);
  const [imageModelId, setImageModelIdState] = useState(DEFAULT_IMAGE_MODEL_ID);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setModelIdState(resolveModelId(stored));
    }
    const imageStored = window.localStorage.getItem(IMAGE_STORAGE_KEY);
    if (imageStored) {
      setImageModelIdState(resolveImageModelId(imageStored));
    }
  }, []);

  const setModelId = useCallback((next: string) => {
    const resolved = resolveModelId(next);
    setModelIdState(resolved);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    }
  }, []);

  const setImageModelId = useCallback((next: string) => {
    const resolved = resolveImageModelId(next);
    setImageModelIdState(resolved);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(IMAGE_STORAGE_KEY, resolved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, modelId);
  }, [modelId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(IMAGE_STORAGE_KEY, imageModelId);
  }, [imageModelId]);

  const value = useMemo(
    () => ({
      modelId,
      setModelId,
      imageModelId,
      setImageModelId,
    }),
    [modelId, setModelId, imageModelId, setImageModelId]
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
