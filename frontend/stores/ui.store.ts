import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

type ToastVariant = 'default' | 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface UIState {
  sidebarCollapsed: boolean;
  toasts: Toast[];

  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarCollapsed: false,
        toasts: [],

        toggleSidebar: () =>
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

        setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

        addToast: (message, variant = 'default', duration = 4000) => {
          const id = crypto.randomUUID();
          set((state) => ({ toasts: [...state.toasts, { id, message, variant, duration }] }));
          if (duration > 0) {
            setTimeout(() => {
              set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
            }, duration);
          }
        },

        removeToast: (id) =>
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
      }),
      {
        name: 'lm-ui',
        partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
      },
    ),
    { name: 'UIStore' },
  ),
);

export const useToast = () => {
  const { addToast } = useUIStore();
  return {
    toast: addToast,
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    warning: (msg: string) => addToast(msg, 'warning'),
  };
};
