import { PRIVACY_CONTACT, RETENTION_MONTHS } from '../config';
import { useDocumentTitle } from '../useDocumentTitle';
import styles from './Page.module.css';

export function Privacy() {
  useDocumentTitle('Privacy');
  return (
    <article className={styles.page}>
      <h1 className={styles.title}>Privacy</h1>
      <p className={styles.lede}>
        We collect as little as we can, and nothing that says who you are.
      </p>

      <div className={styles.prose}>
        <h2>What we store</h2>
        <ul>
          <li>Your age in whole years. We don’t store your date of birth.</li>
          <li>Your answers, how long each one took, and your result.</li>
          <li>
            A random ID kept in your browser, so a retake doesn’t show you questions you’ve already
            seen.
          </li>
        </ul>

        <h2>What we don’t store</h2>
        <p>
          We don’t store your name, email address, date of birth or IP address. There are no
          adverts, no tracking and no analytics cookies.
        </p>

        <h2>Why we use it</h2>
        <p>
          We use your answers to work out and show your result. If you say yes to research use, your
          first test’s anonymous results also help make scores more accurate for everyone. That’s
          optional, and you can still take the test if you say no.
        </p>

        <h2>Under 16?</h2>
        <p>
          We follow the ICO’s Children’s Code. For under-16s, research use is switched off unless
          you choose to switch it on. We only keep what we need to work out your score.
        </p>

        <h2>Cookies and browser storage</h2>
        <p>
          We use one cookie, which the test needs to work. It links your visits so a retake gets new
          questions. Your browser also remembers your colour theme. That stays on your device and
          isn’t sent to us.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We delete test records after {RETENTION_MONTHS} months. If you clear this site’s data from
          your browser, the random ID goes too, and we can’t link a new test to your old one.
        </p>

        <h2>Your rights</h2>
        <p>
          Under UK GDPR you can ask what we hold about you, or ask us to delete it. We don’t know
          who you are, so we’ll need the random ID from your browser to find your records. Write to{' '}
          <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>. If you’re not happy with our
          answer, you can complain to the{' '}
          <a href="https://ico.org.uk/make-a-complaint/">Information Commissioner’s Office</a>.
        </p>
      </div>
    </article>
  );
}
