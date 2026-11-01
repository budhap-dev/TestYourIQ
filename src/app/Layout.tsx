import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { AppearanceMenu } from '../components/AppearanceMenu';
import { APP_NAME } from './config';
import { promptInstall, useInstallOption } from './install';
import styles from './Layout.module.css';

function Mark({ className }: { className?: string | undefined }) {
  return (
    <svg className={className} viewBox="0 0 28 28" aria-hidden="true">
      <g fill="currentColor">
        {[0, 1, 2].flatMap((row) =>
          [0, 1, 2].map((col) =>
            row === 2 && col === 2 ? null : (
              <rect
                key={`${row}-${col}`}
                x={2 + col * 8.5}
                y={2 + row * 8.5}
                width="7"
                height="7"
                rx="1.5"
                opacity={0.45 + 0.15 * ((row + col) % 3)}
              />
            ),
          ),
        )}
      </g>
      <rect
        x="19.5"
        y="19.5"
        width="6"
        height="6"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeDasharray="2 1.5"
      />
    </svg>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  const installOption = useInstallOption();
  const [showIosSteps, setShowIosSteps] = useState(false);

  // Move focus to the main region on navigation so screen readers announce the new page.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.wordmark}>
            <Mark className={styles.mark} />
            <span>
              {APP_NAME.split(/(IQ)/).map((part, i) =>
                part === 'IQ' ? (
                  <span key={i} className={styles.wordmarkAccent}>
                    {part}
                  </span>
                ) : (
                  part
                ),
              )}
            </span>
          </Link>
          <AppearanceMenu />
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>An estimate of reasoning ability, not a clinical assessment.</p>
          <nav aria-label="Footer" className={styles.footerLinks}>
            {installOption && (
              <button
                type="button"
                className={styles.footerButton}
                aria-expanded={installOption === 'ios' ? showIosSteps : undefined}
                aria-controls={installOption === 'ios' ? 'install-steps' : undefined}
                onClick={() =>
                  installOption === 'ios' ? setShowIosSteps((v) => !v) : void promptInstall()
                }
              >
                Install app
              </button>
            )}
            <Link to="/privacy">Privacy</Link>
          </nav>
          {installOption === 'ios' && showIosSteps && (
            <p id="install-steps" className={styles.installSteps}>
              To add {APP_NAME} to your home screen, tap <strong>Share</strong> in Safari (on newer
              iPhones it’s in the <strong>⋯</strong> menu), then <strong>Add to Home Screen</strong>
              .
            </p>
          )}
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
