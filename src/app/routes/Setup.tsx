import { useDocumentTitle } from '../useDocumentTitle';
import styles from './Page.module.css';

export function Setup() {
  useDocumentTitle('Before you start');
  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>Step 1 of 3</p>
      <h1 className={styles.title}>Before you start</h1>
      <p className={styles.lede}>Age, consent and a short practice round will go here.</p>
      <div className={styles.skeleton} aria-hidden="true" />
    </div>
  );
}
