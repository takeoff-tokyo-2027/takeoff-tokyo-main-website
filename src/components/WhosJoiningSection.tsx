import '../styles/whos-joining.css';

interface Company {
  name: string;
  fullName: string;
  url: string;
  src: string;
}

// First desktop row from Super Office Hours 2026; edit these lists for this event.
const startups: Company[] = [
  {
    name: 'Adora',
    fullName: 'Adora株式会社 (Adora Inc.)',
    url: 'https://www.kodomamo.com/',
    src: '/images/logos/startups/adora.png',
  },
  {
    name: 'Alice',
    fullName: 'Alice',
    url: 'https://project-alice.us/',
    src: '/images/logos/startups/alice.png',
  },
  {
    name: 'Aniwell',
    fullName: 'Aniwell',
    url: 'https://aniwell.net/',
    src: '/images/logos/startups/aniwell.png',
  },
  {
    name: 'Anosa AI',
    fullName: 'Anosa AI',
    url: 'https://www.anosa.ai/',
    src: '/images/logos/startups/anosa.png',
  },
  {
    name: 'Atlas',
    fullName: 'Atlas Technologies AS (Atlas.co)',
    url: 'https://atlas.co/',
    src: '/images/logos/startups/atlas.png',
  },
  {
    name: 'AUBE Security',
    fullName: 'AUBE Security',
    url: 'https://www.aubesecurity.com/',
    src: '/images/logos/startups/aube.png',
  },
  {
    name: 'Birdy',
    fullName: 'Birdy Ventures',
    url: 'https://birdy.co.jp/',
    src: '/images/logos/startups/birdy.png',
  },
];

const investors: Company[] = [
  {
    name: 'Akai Wagon Partners',
    fullName: 'Akai Wagon Partners',
    url: 'https://akaiwagon.com/',
    src: '/images/logos/investors/akaiwagon.png',
  },
  {
    name: 'Alpha VC',
    fullName: '株式会社ALPHA (ALPHA / ALPHA VC)',
    url: 'https://alphavc.jp/',
    src: '/images/logos/investors/alpha.png',
  },
  {
    name: 'Antler',
    fullName: 'Antler (Antler Japan)',
    url: 'https://www.antler.co/',
    src: '/images/logos/investors/antler.png',
  },
  {
    name: 'Archetype Ventures',
    fullName: 'アーキタイプベンチャーズ株式会社 (Archetype Ventures)',
    url: 'https://archetype.vc/',
    src: '/images/logos/investors/archetype.png',
  },
  {
    name: 'Apollo Capital',
    fullName: '株式会社アポロ・キャピタル (Apollo Capital Inc.)',
    url: 'https://apollocap.co.jp/',
    src: '/images/logos/investors/apollo.png',
  },
  {
    name: 'Artemis Ventures',
    fullName: 'ARTEMIS VENTURES, LTD.',
    url: 'https://www.artemis-ventures.vc/',
    src: '/images/logos/investors/artemis.png',
  },
  {
    name: 'Atrae',
    fullName: '株式会社アトラエ (Atrae, Inc.)',
    url: 'https://atrae.co.jp/',
    src: '/images/logos/investors/atrae.svg',
  },
];

export function WhosJoiningSection() {
  return (
    <section id="who" className="who-section" aria-labelledby="who-title">
      <div className="site-container">
        <h2 id="who-title" className="section-title">
          Who's Joining
        </h2>
        {[
          { label: 'Startups', companies: startups },
          { label: 'Investors', companies: investors },
        ].map(({ label, companies }) => (
          <div className="who-group" key={label}>
            <h3 className="who-label">{label}</h3>
            <div className="who-grid">
              {companies.map((company) => (
                <a
                  key={company.name}
                  className="who-tile"
                  href={company.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={company.fullName}
                  aria-label={company.fullName}
                >
                  <img src={company.src} alt={company.fullName} loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
