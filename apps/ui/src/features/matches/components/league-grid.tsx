import { Link } from 'react-router-dom'
import type { League } from '../../../lib/types'
import { useApi } from '../../../lib/use-api'
import { ErrorNote, Loading, Section } from '../../../components/bits'

/** League logo in the variant that suits the current theme. */
export function LeagueLogo({ league, className = 'size-12' }: { league: League; className?: string }) {
  const props = { alt: '', loading: 'lazy' as const, decoding: 'async' as const, width: 96, height: 96 }
  return (
    <>
      <img src={league.logoUrl} className={`${className} object-contain dark:hidden`} {...props} />
      <img src={league.darkLogoUrl} className={`${className} hidden object-contain dark:block`} {...props} />
    </>
  )
}

/** Leagues supported by the sports provider for the viewer's country. */
export function LeagueGrid({ countryCode }: { countryCode?: string }) {
  const query = useApi<{ leagues: League[] }>(`/api/sports/leagues${countryCode ? `?countryCode=${countryCode}` : ''}`)

  return (
    <Section title="Leagues">
      {query.loading ? (
        <Loading />
      ) : query.error ? (
        <ErrorNote error={query.error} onRetry={query.reload} />
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {query.data?.leagues.map((league) => (
            <li key={league.code}>
              <Link
                to={`/leagues/${encodeURIComponent(league.code)}`}
                className="flex h-full flex-col items-center gap-2 rounded-2xl border border-border p-3 text-center text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <LeagueLogo league={league} />
                <span className="line-clamp-2">{league.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
