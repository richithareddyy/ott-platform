// Terms, privacy, credits, and copyright pages. These describe what this app
// actually does, so update them whenever data handling or third parties change.
const Legal = (() => {
  const { esc } = UI;
  const UPDATED = '7 November 2026';
  const issues = () => `${SITE.github}/issues`;
  const ext = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;

  function shell(eyebrow, title, intro, body) {
    return `<article class="page legal">
      <header class="legal-head">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p class="legal-intro">${intro}</p>
        <p class="legal-updated">Last updated ${UPDATED}</p>
      </header>
      <nav class="legal-nav" aria-label="Policies">
        <a href="#/terms" data-legal="terms">Terms</a><a href="#/privacy" data-legal="privacy">Privacy</a>
        <a href="#/credits" data-legal="credits">Credits</a><a href="#/copyright" data-legal="copyright">Copyright</a>
      </nav>
      <div class="legal-body">${body}</div>
    </article>`;
  }

  const terms = () => shell('Legal', 'Terms of use',
    `StreamBox is a portfolio project built by ${esc(SITE.author)} to demonstrate a streaming web app. It is free, has no subscriptions, and is not a commercial streaming service.`,
    `<h2>What StreamBox is</h2>
    <p>StreamBox lets you browse a small catalog, keep a list, rate and review titles, and pick up where you left off. The films in the catalog are open movies made by the Blender Foundation and Blender Studio and released under Creative Commons licenses. StreamBox does not host, own, or license them; they play through YouTube's embedded player. See <a href="#/credits">Credits</a> for each film's creator and license.</p>
    <p>StreamBox is not affiliated with, sponsored by, or endorsed by the Blender Foundation, Blender Studio, YouTube, or Google.</p>

    <h2>Playback through YouTube</h2>
    <p>When you play a film, the video is streamed by YouTube, and your use of the player is also governed by the ${ext('https://www.youtube.com/t/terms', 'YouTube Terms of Service')}. If YouTube removes or restricts a video, it stops playing here.</p>

    <h2>Accounts</h2>
    <p>You can create an account with a name, email address, and password, or use the shared guest account behind <strong>Try the demo</strong>. Anything saved to the guest account, such as its list and playback positions, is visible to everyone else who uses it, so don't put anything personal there. Keep your password private; you are responsible for activity on your account. Please don't create an account if you are under 13.</p>

    <h2>Your reviews</h2>
    <p>Reviews you post, including your display name, are shown publicly on the title's page. You keep ownership of what you write and allow StreamBox to display it for as long as it stays on the site. Don't post anything unlawful, hateful, harassing, or infringing, or personal information about other people. Reviews that break these rules may be removed.</p>

    <h2>Acceptable use</h2>
    <p>Don't try to access other people's accounts, get around rate limits or security, overload the service, or use it to distribute content you don't have the right to share.</p>

    <h2>Demo data and availability</h2>
    <p>Because this is a demonstration, the database may be reset at any time, which deletes all accounts, lists, progress, and reviews. The site runs on a free hosting plan that sleeps when idle, so the first visit can be slow, and it may change or shut down without notice.</p>

    <h2>No warranty</h2>
    <p>StreamBox is provided as is, without warranties of any kind. To the extent the law allows, its author is not liable for any loss arising from using it.</p>

    <h2>Source code</h2>
    <p>The source is public ${ext(SITE.github, 'on GitHub')}. The repository does not include an open-source license, so viewing the code does not by itself grant permission to reuse it.</p>

    <h2>Contact</h2>
    <p>Questions about these terms can be raised by ${ext(issues(), 'opening an issue on GitHub')}. Issues are public, so don't include personal details.</p>`);

  const privacy = () => shell('Legal', 'Privacy policy',
    'This page lists exactly what StreamBox stores, what your browser sends to other services while you use it, and how to delete your data.',
    `<h2>What StreamBox stores</h2>
    <table class="legal-table">
      <thead><tr><th>Data</th><th>Why</th><th>Kept until</th></tr></thead>
      <tbody>
        <tr><td>Name, email address, and a bcrypt hash of your password (the password itself is never stored)</td><td>To sign you in and show your name</td><td rowspan="4">You delete your account, or the demo database is reset</td></tr>
        <tr><td>Titles in My List, with the time you added them</td><td>To show your list</td></tr>
        <tr><td>Playback position, length, and completion for titles you play, with timestamps</td><td>Continue watching and resume</td></tr>
        <tr><td>Your ratings and reviews, with your display name and dates</td><td>Shown publicly on title pages</td></tr>
        <tr><td>Your IP address, in server memory only</td><td>To limit repeated sign-in and sign-up attempts</td><td>Up to 15 minutes; never written to the database</td></tr>
      </tbody>
    </table>
    <p>Each title also keeps an overall play count and rating average. These totals are shown publicly but don't identify you.</p>
    <p>StreamBox has no ads, analytics, or tracking pixels, and it doesn't sell or share your data. Data is stored with the hosting providers below, in the United States.</p>

    <h2>In your browser</h2>
    <p>StreamBox itself sets no cookies. When you sign in, it saves one item in your browser's local storage, <code>streambox.session</code>, containing a sign-in token (valid for 7 days) and your name, email, and account type. Signing out or pressing <strong>Exit</strong> removes it.</p>

    <h2>Other services your browser contacts</h2>
    <ul>
      <li><strong>YouTube (Google).</strong> Title artwork is loaded from YouTube's image servers (<code>i.ytimg.com</code>) as you browse. When you press Play on a film, StreamBox loads YouTube's player script from <code>youtube.com</code> and the player from <code>youtube-nocookie.com</code>, its privacy-enhanced mode. YouTube receives your IP address and browser details, and once the video plays it may set cookies or local storage and collect data under the ${ext('https://policies.google.com/privacy', 'Google Privacy Policy')}. StreamBox uses YouTube API Services; using the player means you also agree to the ${ext('https://www.youtube.com/t/terms', 'YouTube Terms of Service')}. StreamBox only reads the playback position from the player to save your progress.</li>
      <li><strong>Google Fonts.</strong> The Inter typeface is loaded from <code>fonts.googleapis.com</code> and <code>fonts.gstatic.com</code>, which receive your IP address and browser details. See ${ext('https://developers.google.com/fonts/faq/privacy', 'Google Fonts privacy')}.</li>
      <li><strong>GitHub.</strong> Contacted only if you follow a link to the source code.</li>
    </ul>

    <h2>Hosting</h2>
    <p>The site runs on ${ext('https://render.com/privacy', 'Render')} and the database on ${ext('https://www.mongodb.com/legal/privacy/privacy-policy', 'MongoDB Atlas')}, both in the US. Like most hosts, Render may keep request logs, which include IP addresses, under its own policy. When a request fails with a server error, StreamBox writes the request method, full URL, and error details to those logs.</p>

    <h2>The shared guest account</h2>
    <p><strong>Try the demo</strong> signs you into one account shared by every guest. Its list and playback positions are visible to all guests, and it can't post reviews or be deleted.</p>

    <h2>Deleting your data</h2>
    <p>Signed in with your own account, open <a href="#/account">Account</a> and choose <strong>Delete account</strong>. This immediately deletes your account, list, playback progress, and reviews, updates the rating totals, and signs you out. Other devices you were signed in on can no longer save anything to the account. Hosting providers may keep logs or backups for a time under their own policies.</p>

    <h2>Security</h2>
    <p>Passwords are hashed with bcrypt, the site is served over HTTPS, and sign-in attempts are rate-limited. No system is perfectly secure, so use a password you don't use anywhere else.</p>

    <h2>Children</h2>
    <p>StreamBox isn't directed to children under 13 and doesn't knowingly collect their data.</p>

    <h2>Changes and contact</h2>
    <p>If what StreamBox collects changes, this page will be updated along with the date above. For questions, ${ext(issues(), 'open an issue on GitHub')} without including personal details; to remove your data, use <strong>Delete account</strong>.</p>`);

  async function credits() {
    const { items } = await Api.listTitles({ sort: 'newest', limit: 50 });
    const films = (await Promise.all(items.filter((t) => t.youtubeId).map((t) => Api.title(t._id)))).map((r) => r.title);
    const filmRows = films.map((t) => `<tr>
      <td><a href="#/title/${esc(t._id)}">${esc(t.name)}</a> <span class="muted">(${esc(t.releaseYear)})</span></td>
      <td>© ${esc(t.credit || 'Unknown')}</td>
      <td>${t.license ? ext(t.licenseUrl, esc(t.license)) : '<span class="muted">Not listed</span>'}</td>
      <td>${t.sourceUrl ? ext(t.sourceUrl, 'YouTube') : ''}</td>
    </tr>`).join('');

    return shell('Credits', 'Credits and attributions',
      'StreamBox is built on other people’s work. Here is everything it uses, who made it, and the license or terms it is used under.',
      `<h2>Films</h2>
      <p>Every film is an open movie by the Blender Foundation or Blender Studio. Each is shown unchanged, played through YouTube's embedded player from the official Blender channels, and used under the Creative Commons license listed. Artwork is a frame from the film, served by YouTube and cropped to fit. Synopses are written for StreamBox; release years, runtimes, and directors were checked against Wikipedia and the films' YouTube pages.</p>
      ${filmRows ? `<div class="table-wrap"><table class="legal-table">
        <thead><tr><th>Film</th><th>Made by</th><th>License</th><th>Source</th></tr></thead>
        <tbody>${filmRows}</tbody>
      </table></div>` : '<p class="muted">The film catalog hasn’t been loaded into this database yet.</p>'}
      <p>Cosmos Laundromat is licensed CC BY-SA, which also requires that adaptations be shared under the same license; StreamBox only embeds it unchanged. Blender is a trademark of the Blender Foundation. StreamBox is not affiliated with or endorsed by the Blender Foundation or Blender Studio.</p>

      <h2>Video and images</h2>
      <p>Videos and thumbnails are provided by YouTube using YouTube API Services, subject to the ${ext('https://www.youtube.com/t/terms', 'YouTube Terms of Service')}. YouTube is a trademark of Google LLC.</p>

      <h2>Type and icons</h2>
      <ul>
        <li><strong>Inter</strong> by Rasmus Andersson, ${ext('https://openfontlicense.org', 'SIL Open Font License 1.1')}, served by Google Fonts.</li>
        <li>Interface icons, the StreamBox logo, and the generated artwork used for titles without video were made for this project.</li>
        <li>The GitHub mark belongs to GitHub, Inc. and is used only to link to this project's repository.</li>
      </ul>

      <h2>Software</h2>
      <p>The server uses open-source packages whose license notices are included with each package:</p>
      <ul>
        <li>${ext('https://nodejs.org', 'Node.js')}, ${ext('https://expressjs.com', 'Express')}, ${ext('https://mongoosejs.com', 'Mongoose')}, ${ext('https://github.com/auth0/node-jsonwebtoken', 'jsonwebtoken')}, and ${ext('https://github.com/dcodeIO/bcrypt.js', 'bcrypt.js')}: MIT License</li>
        <li>${ext('https://github.com/ladjs/supertest', 'Supertest')} (tests only): MIT License</li>
        <li>${ext('https://www.mongodb.com', 'MongoDB')} stores the data, hosted on MongoDB Atlas</li>
      </ul>

      <h2>Hosting</h2>
      <p>Hosted on ${ext('https://render.com', 'Render')}, with the database on ${ext('https://www.mongodb.com/atlas', 'MongoDB Atlas')}.</p>`);
  }

  const copyright = () => shell('Legal', 'Copyright and content reports',
    'How to tell us about content on StreamBox that you believe infringes your rights or breaks the Terms.',
    `<h2>What StreamBox shows</h2>
    <p>StreamBox doesn't host video files. Films are embedded from YouTube, artwork is loaded from YouTube, and the only content stored here is catalog information and the reviews users post.</p>

    <h2>Reporting a problem</h2>
    <p>If you believe something on StreamBox infringes your copyright or trademark, or a review breaks the <a href="#/terms">Terms</a>, ${ext(issues(), 'open an issue on GitHub')} with:</p>
    <ul>
      <li>the work or right you believe is affected, and that you own it or are authorized to act for the owner;</li>
      <li>the StreamBox page where the material appears (its address);</li>
      <li>why you believe it is infringing or against the Terms;</li>
      <li>how to reach you.</li>
    </ul>
    <p>GitHub issues are public, so leave out personal details you don't want published. Material reported in good faith will be reviewed and, where appropriate, removed promptly.</p>

    <h2>Videos on YouTube</h2>
    <p>The videos themselves are hosted by YouTube. To report a video, you can also use ${ext('https://support.google.com/youtube/answer/2807622', 'YouTube’s copyright tools')}; if YouTube removes it, it stops playing here too.</p>`);

  return { terms, privacy, credits, copyright };
})();
