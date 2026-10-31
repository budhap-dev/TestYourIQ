import { ButtonLink } from '../../components/Button';
import { useDocumentTitle } from '../useDocumentTitle';
import styles from './Page.module.css';

export function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>We couldn’t find that page</h1>
      <p className={styles.lede}>The link may be out of date, or the address mistyped.</p>
      <div>
        <ButtonLink to="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </div>
    </div>
  );
}
