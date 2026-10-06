import { useTitle } from '../hooks/useTitle'
import { PORTFOLIO_URL } from '../lib/site'

/** Changed whenever what the site collects changes. */
const LAST_UPDATED = '6 October 2026'

/**
 * What this site records about its readers. Kept to what the code actually does: if a feature that
 * touches reader data is added or removed, this page changes with it.
 */
export function PrivacyPage() {
  useTitle('Privacy')

  return (
    <main className="main main--reading">
      <article className="prose legal">
        <h1 className="article__title">Privacy</h1>
        <p className="faint">Last updated {LAST_UPDATED}</p>

        <p>
          Inkwell is a personal site for reading articles. There are no reader accounts, nothing to sign up for,
          no advertising, and nothing here is sold or shared for marketing. This page lists everything the site
          records when you visit.
        </p>

        <h2>What your browser stores</h2>
        <p>
          The first time you open an article, your browser makes up a random id and keeps it in its own storage for
          this site. It is not a cookie, it is not sent to any other site, and it does not say who you are. It exists
          so that a second click can undo a clap, and so that refreshing a page does not count you as a new reader.
          Clearing this site's data in your browser removes it.
        </p>

        <h2>What the site records</h2>
        <ul>
          <li>
            <strong>Reactions.</strong> If you press Clap or Insightful, the site stores a scrambled, one-way form of
            your random id against that article. Pressing the button again deletes it.
          </li>
          <li>
            <strong>Reader counts.</strong> Opening an article adds one to its reader count, at most once a day. To
            avoid counting you twice, the same scrambled id is kept with the article for up to a day and then deleted.
            The count itself is just a number.
          </li>
          <li>
            <strong>Visit statistics.</strong> Cloudflare Web Analytics counts page visits without cookies and without
            following you across sites. It shows totals such as which pages were opened and from which country.
          </li>
          <li>
            <strong>Server logs.</strong> Like every website, the servers briefly see your internet address in order to
            answer you and to stop abuse, such as one address sending hundreds of requests a minute. These logs are
            short-lived and are not used to identify readers.
          </li>
        </ul>

        <h2>What is not collected</h2>
        <p>
          No names, no email addresses, no passwords and no payment details: there is nowhere on this site to enter
          them. No advertising or social-media trackers are loaded.
        </p>

        <h2>Who runs the machines</h2>
        <p>
          The pages are served by Cloudflare. The articles and pictures come from a server at Render, and are stored
          in a database at Neon. These companies process requests on the site's behalf, under their own privacy terms.
        </p>

        <h2>Links to other sites</h2>
        <p>Articles link to other websites. Those sites have their own practices, which this page does not cover.</p>

        {PORTFOLIO_URL && (
          <>
            <h2>Questions</h2>
            <p>
              You can reach the author through the <a href={`${PORTFOLIO_URL}/contact`}>contact page</a>.
            </p>
          </>
        )}
      </article>
    </main>
  )
}
