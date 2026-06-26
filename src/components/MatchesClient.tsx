"use client";

import { useState } from "react";
import { MatchCard } from "./MatchCard";
import { PickModal, type MatchWithMarkets } from "./PickModal";

type MatchesClientProps = {
  initialMatches: MatchWithMarkets[];
  userPoints: number;
};

export function MatchesClient({ initialMatches, userPoints }: MatchesClientProps) {
  const [matches, setMatches] = useState(initialMatches);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithMarkets | null>(null);
  const [points, setPoints] = useState(userPoints);

  async function refresh() {
    const res = await fetch("/api/matches");
    const data = await res.json();
    setMatches(data.matches);
    const sessionRes = await fetch("/api/auth/session");
    const sessionData = await sessionRes.json();
    if (sessionData.user) setPoints(sessionData.user.points);
  }

  const upcoming = matches.filter((m) => m.status === "UPCOMING" || m.status === "LIVE");
  const finished = matches.filter((m) => m.status === "FINISHED");

  return (
    <>
      <section className="mb-8">
        <h2 className="section-title">Upcoming & Live</h2>
        {upcoming.length === 0 ? (
          <p className="text-slate-400">No upcoming matches.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((match) => (
              <MatchCard key={match.id} match={match} onPick={() => setSelectedMatch(match)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">Results</h2>
        {finished.length === 0 ? (
          <p className="text-slate-400">No finished matches yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {finished.map((match) => (
              <MatchCard key={match.id} match={match} showPickButton={false} />
            ))}
          </div>
        )}
      </section>

      {selectedMatch && (
        <PickModal
          match={selectedMatch}
          userPoints={points}
          userPicks={selectedMatch.picks ?? []}
          onClose={() => setSelectedMatch(null)}
          onSuccess={refresh}
        />
      )}
    </>
  );
}
