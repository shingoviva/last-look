"use client";

import { create } from "zustand";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { Locale } from "@/lib/i18n";
import type { CompareMode, ImageItem, ImageSettings, PreviewContext, RatioKey } from "@/lib/types";

type Store = {
  locale: Locale;
  images: ImageItem[];
  selectedId: string | null;
  preview: PreviewContext;
  compare: CompareMode;
  mobilePanel: "crop" | "look" | "preview" | "export";
  mobileSheetHeight: number;
  setImages: (images: ImageItem[]) => void;
  addImages: (images: ImageItem[]) => void;
  select: (id: string) => void;
  remove: (id: string) => void;
  reorder: (from: number, to: number) => void;
  toggleExport: (id: string) => void;
  setAllExport: (enabled: boolean) => void;
  setPreview: (preview: PreviewContext) => void;
  setCompare: (compare: CompareMode) => void;
  setMobilePanel: (panel: Store["mobilePanel"]) => void;
  setMobileSheetHeight: (height: number) => void;
  setSharedRatio: (ratio: RatioKey) => void;
  updateSettings: (id: string, patch: Partial<ImageSettings>) => void;
  applyToAll: (keys: (keyof ImageSettings)[]) => void;
  resetCrop: (id: string) => void;
  clear: () => void;
  setLocale: (locale: Locale) => void;
};

export const useLastLook = create<Store>((set, get) => ({
  locale: "en",
  images: [],
  selectedId: null,
  preview: "feed",
  compare: "edited",
  mobilePanel: "crop",
  mobileSheetHeight: 190,
  setImages: (images) => set({ images, selectedId: images[0]?.id ?? null }),
  addImages: (newImages) =>
    set((state) => {
      const sharedRatio = state.images.find((image) => image.id === state.selectedId)?.settings.ratio ?? state.images[0]?.settings.ratio;
      const imagesToAdd = sharedRatio
        ? newImages.map((image) => ({
            ...image,
            settings: {
              ...image.settings,
              ratio: sharedRatio,
              zoom: 1,
              x: 0,
              y: 0,
            },
          }))
        : newImages;
      return {
        images: [...state.images, ...imagesToAdd],
        selectedId: state.selectedId ?? imagesToAdd[0]?.id ?? null,
      };
    }),
  select: (selectedId) => set({ selectedId }),
  remove: (id) =>
    set((state) => {
      const item = state.images.find((image) => image.id === id);
      if (item) URL.revokeObjectURL(item.url);
      const images = state.images.filter((image) => image.id !== id);
      return {
        images,
        selectedId: state.selectedId === id ? images[0]?.id ?? null : state.selectedId,
      };
    }),
  reorder: (from, to) =>
    set((state) => {
      const images = [...state.images];
      const [moved] = images.splice(from, 1);
      images.splice(to, 0, moved);
      return { images };
    }),
  toggleExport: (id) =>
    set((state) => ({
      images: state.images.map((image) =>
        image.id === id ? { ...image, exportEnabled: !image.exportEnabled } : image,
      ),
    })),
  setAllExport: (enabled) =>
    set((state) => ({
      images: state.images.map((image) => ({ ...image, exportEnabled: enabled })),
    })),
  setPreview: (preview) => set({ preview }),
  setCompare: (compare) => set({ compare }),
  setMobilePanel: (mobilePanel) =>
    set((state) => ({ mobilePanel, mobileSheetHeight: Math.max(state.mobileSheetHeight, 190) })),
  setMobileSheetHeight: (mobileSheetHeight) => set({ mobileSheetHeight }),
  setSharedRatio: (ratio) =>
    set((state) => ({
      images: state.images.map((image) => ({
        ...image,
        settings: {
          ...image.settings,
          ratio,
          zoom: 1,
          x: 0,
          y: 0,
        },
      })),
    })),
  updateSettings: (id, patch) =>
    set((state) => ({
      images: state.images.map((image) =>
        image.id === id ? { ...image, settings: { ...image.settings, ...patch } } : image,
      ),
    })),
  applyToAll: (keys) => {
    const state = get();
    const source = state.images.find((image) => image.id === state.selectedId);
    if (!source) return;
    set({
      images: state.images.map((image) => ({
        ...image,
        settings: keys.reduce(
          (settings, key) => ({ ...settings, [key]: source.settings[key] }),
          image.settings,
        ),
      })),
    });
  },
  resetCrop: (id) => get().updateSettings(id, { ...DEFAULT_SETTINGS, ...pickVisual(get(), id) }),
  clear: () => {
    get().images.forEach((image) => URL.revokeObjectURL(image.url));
    set({ images: [], selectedId: null });
  },
  setLocale: (locale) => {
    if (typeof window !== "undefined") window.localStorage.setItem("last-look-locale", locale);
    set({ locale });
  },
}));

function pickVisual(store: Store, id: string) {
  const settings = store.images.find((image) => image.id === id)?.settings;
  return settings
    ? {
        ratio: settings.ratio,
        fitMode: settings.fitMode,
        padding: settings.padding,
        look: settings.look,
        strength: settings.strength,
        safeGuard: settings.safeGuard,
        safeFixSnapshot: settings.safeFixSnapshot,
        zoom: 1,
        x: 0,
        y: 0,
      }
    : DEFAULT_SETTINGS;
}
