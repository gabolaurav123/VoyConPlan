'use client';
import { toast as manager } from '@/components/ui/toast';
export const toast = Object.assign(
  (title: string, opts?: { action?: { label: string; onClick: () => void } }) =>
    manager.add({
      title,
      type: 'info',
      ...(opts?.action
        ? {
            actionProps: {
              children: opts.action.label,
              onClick: opts.action.onClick,
            },
          }
        : {}),
    }),
  {
    success: (title: string) => manager.add({ title, type: 'success' }),
    error: (title: string) => manager.add({ title, type: 'error' }),
  },
);
