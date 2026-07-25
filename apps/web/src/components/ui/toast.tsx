import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(
  () => undefined,
);

export function useToast() {
  return useContext(ToastContext);
}

const config: Record<ToastType, { icon: ReactNode; className: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    className: 'border-emerald-200',
  },
  error: { icon: <XCircle className="h-4 w-4 text-red-500" />, className: 'border-red-200' },
  info: { icon: <Info className="h-4 w-4 text-blue-500" />, className: 'border-blue-200' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={cn(
                'pointer-events-auto flex items-center gap-2.5 rounded-lg border bg-white px-4 py-3 text-sm text-gray-800 shadow-lg',
                config[t.type].className,
              )}
            >
              {config[t.type].icon}
              <span className="flex-1">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
