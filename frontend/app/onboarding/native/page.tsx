'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { onboardingApi } from '@/lib/api/onboarding';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/stores/ui.store';
import { cn } from '@/lib/utils/cn';

const NATIVE_LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
];

export default function NativePage() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isPending, setIsPending] = useState(false);

  const filtered = NATIVE_LANGUAGES.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleContinue() {
    if (!selected) return;
    setIsPending(true);
    try {
      await onboardingApi.setNativeLanguage(selected);
      router.push('/onboarding/diagnosis');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'No se pudo guardar el idioma nativo');
      setIsPending(false);
    }
  }

  return (
    <div className="py-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">¿Cuál es tu lengua materna?</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Adaptamos las explicaciones a tu idioma.</p>
      </motion.div>

      <Input
        placeholder="Buscar idioma..."
        icon={<Search className="h-4 w-4" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
        {filtered.map((lang, i) => (
          <motion.button
            key={lang.code}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            onClick={() => setSelected(lang.code)}
            className={cn(
              'flex items-center gap-2 p-3 rounded-[var(--radius-lg)] border text-left transition-all duration-150',
              selected === lang.code
                ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/8'
                : 'border-[var(--color-border-default)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-strong)]',
            )}
          >
            <span className="text-xl">{lang.flag}</span>
            <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">{lang.name}</span>
          </motion.button>
        ))}
      </div>

      <Button className="w-full" size="lg" disabled={!selected} loading={isPending} onClick={handleContinue}>
        Continuar →
      </Button>
    </div>
  );
}
