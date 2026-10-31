import { useDocumentTitle } from '../useDocumentTitle';
import styles from './Page.module.css';

export function TestPage() {
  useDocumentTitle('Test in progress');
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Test</h1>
      <div className={styles.skeleton} role="status" aria-label="Loading question" />
    </div>
  );
}
