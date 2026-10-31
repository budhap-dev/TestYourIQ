import type { ReactNode } from 'react';
import styles from './Notice.module.css';

interface NoticeProps {
  title?: string;
  tone?: 'notice' | 'neutral';
  children: ReactNode;
}

export function Notice({ title, tone = 'notice', children }: NoticeProps) {
  return (
    <aside
      className={[styles.notice, tone === 'neutral' && styles.neutral].filter(Boolean).join(' ')}
    >
      <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9.25" y="8.5" width="1.5" height="6" rx="0.75" fill="currentColor" />
        <circle cx="10" cy="6" r="1" fill="currentColor" />
      </svg>
      <div>
        {title && <p className={styles.title}>{title}</p>}
        {children}
      </div>
    </aside>
  );
}
