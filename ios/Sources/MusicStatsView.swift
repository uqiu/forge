import SwiftUI

/// Train-time listening, aggregated from every workout soundtrack the app
/// captured. Grows with the data — one workout in, the page is sparse and
/// honest about it. Pushed from the Stats overview like Records.
struct MusicStatsView: View {
    @State private var stats: MusicStats?
    @State private var loading = true

    var body: some View {
        ZStack {
            FG.background.ignoresSafeArea()
            if loading {
                ProgressView().tint(FG.ember)
            } else if let s = stats, (s.workouts ?? 0) > 0 {
                content(s)
            } else {
                emptyState
            }
        }
        .navigationTitle("Music")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
        .task {
            stats = try? await ForgeAPI.musicStats()
            loading = false
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "music.note")
                .font(.system(size: 34)).foregroundStyle(FG.muted)
            Text("No soundtrack data yet")
                .font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
            Text("Enable \"Log music during workouts\" in Settings — every session you train with music starts filling this page.")
                .font(.system(size: 13)).foregroundStyle(FG.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 36)
        }
    }

    private func content(_ s: MusicStats) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    statTile("\(s.songs ?? 0)", "songs played")
                    statTile("\(s.artists ?? 0)", "artists")
                    statTile("\(s.workouts ?? 0)", "workouts")
                }

                if let prSongs = s.pr_songs, !prSongs.isEmpty {
                    card {
                        HStack(spacing: 6) {
                            Image(systemName: "trophy.fill")
                                .font(.system(size: 13)).foregroundStyle(FG.gold)
                            Text("PR songs")
                                .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        }
                        .padding(.bottom, 2)
                        ForEach(Array(prSongs.enumerated()), id: \.offset) { _, song in
                            songRow(song, trailing: "\(song.prs ?? 0) PR\((song.prs ?? 0) == 1 ? "" : "s")",
                                    trailingColor: FG.gold)
                        }
                    }
                }

                if let genres = s.genres, !genres.isEmpty {
                    let maxPlays = max(1, genres.first?.plays ?? 1)
                    card {
                        Text("Genres while training")
                            .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                            .padding(.bottom, 2)
                        ForEach(Array(genres.prefix(8).enumerated()), id: \.offset) { _, g in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(g.genre)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(.white).lineLimit(1)
                                    Spacer()
                                    Text("\(g.plays) play\(g.plays == 1 ? "" : "s") · \(g.workouts ?? 0) workout\((g.workouts ?? 0) == 1 ? "" : "s")")
                                        .font(.system(size: 11).monospacedDigit())
                                        .foregroundStyle(FG.muted)
                                }
                                GeometryReader { geo in
                                    ZStack(alignment: .leading) {
                                        Capsule().fill(FG.secondary)
                                        Capsule().fill(FG.ember.opacity(0.7))
                                            .frame(width: max(8, geo.size.width * CGFloat(g.plays) / CGFloat(maxPlays)))
                                    }
                                }
                                .frame(height: 5)
                            }
                            .padding(.vertical, 3)
                        }
                    }
                }

                if let results = s.genre_results, results.count > 1 {
                    card {
                        Text("Which genre lifts hardest")
                            .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        Text("sets and PRs that landed while each genre was playing — correlation, not causation, but fun to argue about")
                            .font(.system(size: 11)).foregroundStyle(FG.muted)
                            .padding(.bottom, 2)
                        ForEach(Array(results.enumerated()), id: \.offset) { _, g in
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(g.genre)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(.white).lineLimit(1)
                                    Text("\(g.sets) sets" + (g.avg_rpe.map { " · avg RPE \(trim($0))" } ?? ""))
                                        .font(.system(size: 11).monospacedDigit())
                                        .foregroundStyle(FG.muted)
                                }
                                Spacer(minLength: 12)
                                Text("\(trim(g.pr_per_100)) PRs / 100 sets")
                                    .font(.system(size: 11, weight: .semibold).monospacedDigit())
                                    .foregroundStyle(FG.gold)
                            }
                            .padding(.vertical, 3)
                        }
                    }
                }

                if let weekdays = s.weekday_genres, weekdays.count > 1 {
                    let names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                    card {
                        Text("Weekday soundtrack")
                            .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                            .padding(.bottom, 2)
                        ForEach(Array(weekdays.enumerated()), id: \.offset) { _, d in
                            HStack(alignment: .firstTextBaseline) {
                                Text(names[d.weekday % 7])
                                    .font(.system(size: 13)).foregroundStyle(FG.muted)
                                Spacer()
                                (Text(d.genre)
                                    .font(.system(size: 13, weight: .medium)).foregroundStyle(.white)
                                 + Text("  \(Int((Double(d.plays) / Double(max(1, d.total))) * 100))%")
                                    .font(.system(size: 11).monospacedDigit()).foregroundStyle(FG.muted))
                                    .lineLimit(1)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }

                if let artists = s.top_artists, !artists.isEmpty {
                    let maxPlays = max(1, artists.first?.plays ?? 1)
                    card {
                        Text("Top artists while training")
                            .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                            .padding(.bottom, 2)
                        ForEach(Array(artists.enumerated()), id: \.offset) { _, artist in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(artist.artist)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(.white).lineLimit(1)
                                    Spacer()
                                    Text("\(artist.plays) play\(artist.plays == 1 ? "" : "s")")
                                        .font(.system(size: 11).monospacedDigit())
                                        .foregroundStyle(FG.muted)
                                }
                                GeometryReader { geo in
                                    ZStack(alignment: .leading) {
                                        Capsule().fill(FG.secondary)
                                        Capsule().fill(FG.ember.opacity(0.7))
                                            .frame(width: max(8, geo.size.width * CGFloat(artist.plays) / CGFloat(maxPlays)))
                                    }
                                }
                                .frame(height: 5)
                            }
                            .padding(.vertical, 3)
                        }
                    }
                }

                if let songs = s.top_songs, !songs.isEmpty {
                    card {
                        Text("Most played songs")
                            .font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                            .padding(.bottom, 2)
                        ForEach(Array(songs.enumerated()), id: \.offset) { i, song in
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                Text("\(i + 1)")
                                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                                    .foregroundStyle(FG.muted)
                                    .frame(width: 18, alignment: .center)
                                songRow(song, trailing: "×\(song.plays ?? 0)", trailingColor: FG.muted)
                            }
                        }
                    }
                }

                if let inferred = s.sources?.inferred, inferred > 0 {
                    Text("\(inferred) of \(s.songs ?? 0) songs were gap-filled from Apple Music's recently played (≈ in workout soundtracks) — the rest were heard live by the app.")
                        .font(.system(size: 11)).foregroundStyle(FG.muted)
                        .padding(.horizontal, 2)
                }

                Color.clear.frame(height: 30)
            }
            .padding(.horizontal, 18)
            .padding(.top, 8)
        }
    }

    private func songRow(_ song: MusicSongRow, trailing: String, trailingColor: Color) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 1) {
                Text(song.title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.white).lineLimit(1)
                if let artist = song.artist {
                    Text(artist)
                        .font(.system(size: 11)).foregroundStyle(FG.muted).lineLimit(1)
                }
            }
            Spacer(minLength: 12)
            Text(trailing)
                .font(.system(size: 11, weight: .semibold).monospacedDigit())
                .foregroundStyle(trailingColor)
        }
        .padding(.vertical, 3)
    }

    private func statTile(_ value: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 17, weight: .semibold).monospacedDigit())
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: 11)).foregroundStyle(FG.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 14).fill(FG.card))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FG.border, lineWidth: 1))
    }

    private func card(@ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(FG.card))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(FG.border, lineWidth: 1))
    }
}
