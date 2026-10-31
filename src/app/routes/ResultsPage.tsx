import { useDocumentTitle } from '../useDocumentTitle';
import styles from './Page.module.css';

export function ResultsPage() {
  useDocumentTitle('Your results');
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your results</h1>
      <div className={styles.skeleton} role="status" aria-label="Loading results" />
    </div>
  );
}
