import { ChevronLeft, Dumbbell, MicVocal, Music, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import { api } from '../lib/api'
import { t, tc } from '../lib/i18n'

interface ArtistRow {
  artist: string
  plays: number
  workouts: number
}

interface SongRow {
  title: string
  artist: string | null
  plays: number
  prs: number
  workouts: number
}

interface GenreRow {
  genre: string
  plays: number
  workouts: number
}

interface GenreResultRow {
  genre: string
  sets: number
  prs: number
  pr_per_100: number
  avg_rpe: number | null
}

interface WeekdayGenreRow {
  weekday: number // 0 = Monday
  genre: string
  plays: number
  total: number
}

interface MusicStats {
  workouts: number
  songs: number
  unique_songs: number
  artists: number
  top_artists: ArtistRow[]
  top_songs: SongRow[]
  pr_songs: SongRow[]
  genres?: GenreRow[]
  genre_results?: GenreResultRow[]
  weekday_genres?: WeekdayGenreRow[]
  sources: { live: number; inferred: number }
}

const WEEKDAYS = [
  'weekday|Monday',
  'weekday|Tuesday',
  'weekday|Wednesday',
  'weekday|Thursday',
  'weekday|Friday',
  'weekday|Saturday',
  'weekday|Sunday',
]

/** Train-time listening, aggregated from every workout soundtrack the
 *  companion captured. Everything grows with the data — one workout in,
 *  the page is sparse and honest about it. */
export default function MusicStatsPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<MusicStats | null>(null)

  useEffect(() => {
    api<MusicStats>('/stats/music').then(setStats).catch(() => setStats(null))
  }, [])

  const maxArtistPlays = stats?.top_artists[0]?.plays ?? 1

  return (
    <div className="safe-top px-4 md:max-w-2xl">
      <header className="flex items-center gap-2 pt-4 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="touch-feedback -ml-2 rounded-full p-2 text-muted-foreground"
          aria-label={t('Back')}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl">{t('Music')}</h1>
      </header>

      {stats == null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : stats.workouts === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t(
            'No soundtrack data yet. Enable “Log music during workouts” in the iPhone app’s settings — every session you train with music will start filling this page.',
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-3 pb-8">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border bg-card p-3 text-center">
              <Music size={16} className="mx-auto mb-1 text-muted-foreground" />
              <div className="tnum font-semibold">{stats.songs}</div>
              <div className="text-xs text-muted-foreground">{t('songs played')}</div>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <MicVocal size={16} className="mx-auto mb-1 text-muted-foreground" />
              <div className="tnum font-semibold">{stats.artists}</div>
              <div className="text-xs text-muted-foreground">{t('artists')}</div>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <Dumbbell size={16} className="mx-auto mb-1 text-muted-foreground" />
              <div className="tnum font-semibold">{stats.workouts}</div>
              <div className="text-xs text-muted-foreground">{t('workouts')}</div>
            </div>
          </div>

          {stats.pr_songs.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-base">
                <Trophy size={16} className="text-record" /> {t('PR songs')}
              </h2>
              <div className="flex flex-col gap-2">
                {stats.pr_songs.map((s, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.title}</span>
                      {s.artist && (
                        <span className="block truncate text-xs text-muted-foreground">{s.artist}</span>
                      )}
                    </span>
                    <span className="tnum shrink-0 text-xs font-semibold text-record">
                      {s.prs === 1 ? t('{n} PR', { n: s.prs }) : t('{n} PRs', { n: s.prs })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(stats.genres?.length ?? 0) > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-base">{t('Genres while training')}</h2>
              <div className="flex flex-col gap-2.5">
                {stats.genres!.slice(0, 8).map((g) => (
                  <div key={g.genre}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{tc(g.genre)}</span>
                      <span className="tnum shrink-0 text-xs text-muted-foreground">
                        {g.plays === 1 ? t('{n} play', { n: g.plays }) : t('{n} plays', { n: g.plays })}{' '}
                        ·{' '}
                        {g.workouts === 1
                          ? t('{n} workout', { n: g.workouts })
                          : t('{n} workouts', { n: g.workouts })}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{
                          width: `${Math.max(6, (g.plays / (stats.genres![0]?.plays || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(stats.genre_results?.length ?? 0) > 1 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-base">{t('Which genre lifts hardest')}</h2>
              <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
                {t(
                  'sets and PRs that landed while each genre was playing — correlation, not causation, but fun to argue about',
                )}
              </p>
              <div className="flex flex-col gap-2">
                {stats.genre_results!.map((g) => (
                  <div key={g.genre} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{tc(g.genre)}</span>
                      <span className="tnum block text-xs text-muted-foreground">
                        {t('{n} sets', { n: g.sets })}
                        {g.avg_rpe != null && ` · ${t('avg RPE {rpe}', { rpe: g.avg_rpe })}`}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-xs font-semibold text-record">
                      {t('{n} PRs / 100 sets', { n: g.pr_per_100 })}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(stats.weekday_genres?.length ?? 0) > 1 && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-base">{t('Weekday soundtrack')}</h2>
              <div className="flex flex-col gap-1.5">
                {stats.weekday_genres!.map((d) => (
                  <div key={d.weekday} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{t(WEEKDAYS[d.weekday])}</span>
                    <span className="tnum min-w-0 truncate font-medium">
                      {tc(d.genre)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        {Math.round((d.plays / d.total) * 100)}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-base">{t('Top artists while training')}</h2>
            <div className="flex flex-col gap-2.5">
              {stats.top_artists.map((a) => (
                <div key={a.artist}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{a.artist}</span>
                    <span className="tnum shrink-0 text-xs text-muted-foreground">
                      {a.plays === 1 ? t('{n} play', { n: a.plays }) : t('{n} plays', { n: a.plays })}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.max(6, (a.plays / maxArtistPlays) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-base">{t('Most played songs')}</h2>
            <div className="flex flex-col gap-2">
              {stats.top_songs.map((s, i) => (
                <div key={i} className="flex items-baseline gap-3 text-sm">
                  <span className="tnum w-5 shrink-0 text-center font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.title}</span>
                    {s.artist && (
                      <span className="block truncate text-xs text-muted-foreground">{s.artist}</span>
                    )}
                  </span>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">
                    ×{s.plays}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {stats.sources.inferred > 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              {t(
                '{inferred} of {total} songs were gap-filled from Apple Music’s recently played (≈ in workout soundtracks) — the rest were heard live by the app.',
                { inferred: stats.sources.inferred, total: stats.songs },
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
