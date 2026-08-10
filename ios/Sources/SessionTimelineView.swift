import SwiftUI

/// Where the session's minutes went: one lane per exercise, a dot per set
/// completion, the soundtrack running underneath on the same clock. Tap a
/// dot or song block for its details (the web app's hover, touch-sized).
/// Renders nothing when the sets carry no completion stamps.
struct SessionTimelineView: View {
    let workout: WorkoutFull

    // Gaps outside this band are exercise changes / interruptions, not rest —
    // same bounds the backend's pacing stats use.
    private static let restMin: TimeInterval = 15
    private static let restMax: TimeInterval = 600

    private struct Dot {
        let x: Double // 0…1 across the session
        let line1: String
        let line2: String
        let warmup: Bool
        let pr: Bool
    }

    private struct Lane {
        let name: String
        let dots: [Dot]
        let medianGap: Int? // seconds between consecutive set completions
    }

    private struct SongBlock {
        let x: Double
        let w: Double
        let line1: String
        let line2: String
        let inferred: Bool
    }

    private struct Model {
        let lanes: [Lane]
        let songs: [SongBlock]
        let ticks: [(x: Double, label: String)]
    }

    private struct Selection: Equatable {
        let lane: Int // -1 = song strip
        let index: Int
    }

    @State private var selected: Selection?

    var body: some View {
        if let model = buildModel() {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Timeline")
                        .font(.system(size: 11, weight: .semibold)).tracking(0.8)
                        .foregroundStyle(FG.muted)
                    Spacer()
                    Text("minutes into the session")
                        .font(.system(size: 11)).foregroundStyle(FG.muted)
                }
                ForEach(Array(model.lanes.enumerated()), id: \.offset) { li, lane in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(lane.name)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.white).lineLimit(1)
                            Spacer()
                            if let gap = lane.medianGap {
                                Text("~\(mmss(gap)) between sets")
                                    .font(.system(size: 11).monospacedDigit())
                                    .foregroundStyle(FG.muted)
                            }
                        }
                        laneStrip(lane, laneIndex: li)
                    }
                }
                if !model.songs.isEmpty {
                    songStrip(model.songs)
                }
                tickRow(model.ticks)
                (Text("● set · ○ warm-up · ").foregroundStyle(FG.muted)
                 + Text("◆").foregroundStyle(FG.gold)
                 + Text(" PR\(model.songs.isEmpty ? "" : " · bottom strip: what was playing")")
                    .foregroundStyle(FG.muted))
                    .font(.system(size: 11))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 14).fill(FG.card))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(FG.border, lineWidth: 1))
        }
    }

    // MARK: strips

    private func laneStrip(_ lane: Lane, laneIndex: Int) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                Rectangle().fill(FG.border).frame(height: 1)
                    .position(x: geo.size.width / 2, y: 10)
                ForEach(Array(lane.dots.enumerated()), id: \.offset) { i, dot in
                    Button {
                        let sel = Selection(lane: laneIndex, index: i)
                        withAnimation(.easeOut(duration: 0.15)) {
                            selected = selected == sel ? nil : sel
                        }
                    } label: {
                        ZStack {
                            Color.clear.frame(width: 26, height: 26)
                            if dot.pr {
                                RoundedRectangle(cornerRadius: 2.5)
                                    .fill(FG.gold)
                                    .frame(width: 11, height: 11)
                                    .rotationEffect(.degrees(45))
                            } else if dot.warmup {
                                Circle().stroke(FG.ember, lineWidth: 2).frame(width: 9, height: 9)
                            } else {
                                Circle().fill(FG.ember).frame(width: 9, height: 9)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .position(x: geo.size.width * dot.x, y: 10)
                }
                if let sel = selected, sel.lane == laneIndex, sel.index < lane.dots.count {
                    tip(lane.dots[sel.index].line1, lane.dots[sel.index].line2,
                        x: lane.dots[sel.index].x, width: geo.size.width)
                }
            }
        }
        .frame(height: 20)
        .zIndex(selected?.lane == laneIndex ? 1 : 0)
    }

    private func songStrip(_ songs: [SongBlock]) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(Array(songs.enumerated()), id: \.offset) { i, s in
                    let opacity = s.inferred ? 0.25 : (i % 2 == 0 ? 0.6 : 0.4)
                    Button {
                        let sel = Selection(lane: -1, index: i)
                        withAnimation(.easeOut(duration: 0.15)) {
                            selected = selected == sel ? nil : sel
                        }
                    } label: {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(FG.ember.opacity(opacity))
                            .frame(width: max(4, geo.size.width * s.w), height: 12)
                    }
                    .buttonStyle(.plain)
                    .position(x: geo.size.width * (s.x + s.w / 2), y: 6)
                }
                if let sel = selected, sel.lane == -1, sel.index < songs.count {
                    let s = songs[sel.index]
                    tip(s.line1, s.line2, x: s.x + s.w / 2, width: geo.size.width)
                }
            }
        }
        .frame(height: 12)
        .zIndex(selected?.lane == -1 ? 1 : 0)
    }

    /// The chart hover card, anchored above its mark and clamped to the strip.
    private func tip(_ line1: String, _ line2: String, x: Double, width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(line1)
                .font(.system(size: 12, weight: .semibold).monospacedDigit())
                .foregroundStyle(.white)
            Text(line2)
                .font(.system(size: 10).monospacedDigit())
                .foregroundStyle(FG.muted)
        }
        .padding(.horizontal, 9).padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 9).fill(FG.background))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(FG.border, lineWidth: 1))
        .fixedSize()
        .alignmentGuide(.leading) { d in
            let anchor = width * x
            // center on the mark, but never poke out of the strip
            return -min(max(anchor - d.width / 2, 0), max(width - d.width, 0))
        }
        .offset(y: -34)
        .transition(.opacity)
        .allowsHitTesting(false)
    }

    private func tickRow(_ ticks: [(x: Double, label: String)]) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                Rectangle().fill(FG.border).frame(width: geo.size.width, height: 1)
                ForEach(Array(ticks.enumerated()), id: \.offset) { _, t in
                    Text(t.label)
                        .font(.system(size: 10).monospacedDigit())
                        .foregroundStyle(FG.muted)
                        .position(x: geo.size.width * t.x, y: 10)
                }
            }
        }
        .frame(height: 16)
    }

    // MARK: model

    private func buildModel() -> Model? {
        guard let t0 = parseISOUTC(workout.started_at),
              let tEnd = workout.finished_at.flatMap({ parseISOUTC($0) }),
              tEnd > t0 else { return nil }
        let span = tEnd.timeIntervalSince(t0)
        func x(_ d: Date) -> Double { min(1, max(0, d.timeIntervalSince(t0) / span)) }

        var stamped = 0
        var lanes: [Lane] = []
        for ex in workout.exercises {
            var dots: [Dot] = []
            var times: [Date] = []
            for s in ex.sets {
                guard let t = parseISOUTC(s.completed_at), let reps = s.reps else { continue }
                times.append(t)
                var line1 = "\(trim(s.weight ?? 0)) kg × \(reps)"
                if let rpe = s.rpe { line1 += " @\(trim(rpe))" }
                if s.is_pr == true { line1 += " · PR" }
                if s.is_warmup == true { line1 += " · warm-up" }
                dots.append(Dot(
                    x: x(t), line1: line1, line2: hhmmLocal(t),
                    warmup: s.is_warmup == true, pr: s.is_pr == true
                ))
            }
            stamped += dots.count
            guard !dots.isEmpty else { continue }
            let gaps = zip(times.dropFirst(), times)
                .map { $0.timeIntervalSince($1) }
                .filter { $0 >= Self.restMin && $0 <= Self.restMax }
                .sorted()
            let median = gaps.isEmpty ? nil : Int(gaps[(gaps.count - 1) / 2])
            lanes.append(Lane(name: ex.name, dots: dots, medianGap: median))
        }
        // A timeline of one or two stamps is noise, not insight
        guard stamped >= 4, !lanes.isEmpty else { return nil }

        var songs: [SongBlock] = []
        for song in workout.music ?? [] {
            guard let s = parseISOUTC(song.started_at) else { continue }
            let e = parseISOUTC(song.ended_at) ?? s
            guard e >= t0, s <= tEnd else { continue }
            let from = max(s, t0), to = min(max(e, s), tEnd)
            var line2 = song.artist.map { "\($0) · " } ?? ""
            line2 += hhmmLocal(from)
            if e > s { line2 += "–\(hhmmLocal(to))" }
            if song.source == "inferred" { line2 += " · ≈" }
            songs.append(SongBlock(
                x: x(from), w: max(x(to) - x(from), 0.008),
                line1: song.title, line2: line2,
                inferred: song.source == "inferred"
            ))
        }

        let stepMin: Double = span > 45 * 60 ? 10 : 5
        var ticks: [(x: Double, label: String)] = []
        var m = 0.0
        while m * 60 <= span {
            ticks.append((x: m * 60 / span, label: "\(Int(m))"))
            m += stepMin
        }
        return Model(lanes: lanes, songs: songs, ticks: ticks)
    }

    private func mmss(_ seconds: Int) -> String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    private func hhmmLocal(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: d)
    }
}
