import { useEffect, useState } from 'react';
import placeholder from '../assets/placeholder_face.svg';
import { buildDoubleElimination, toStageData } from '../features/bracket/manager';
import type { StageData } from '../features/bracket/layout';
import OpeningBracketTour from '../features/presentation/scenes/OpeningBracketTour';

/** ローカル確認用。20チームの初戦を、本番と同じ秒数で一度だけ映す。 */
export default function BracketTourFilm() {
  const [data, setData] = useState<StageData | null>(null);
  useEffect(() => {
    const ids = Array.from({ length: 20 }, (_, index) => `チーム${index + 1}`);
    void buildDoubleElimination(ids).then((snapshot) => setData(toStageData(snapshot)));
  }, []);
  if (!data) return <p className="loading" role="status">表を準備しています</p>;
  const teams = data.participant.map((person) => ({
    id: person.name,
    name: person.name,
    faces: [placeholder, placeholder],
    members: [person.name],
  }));
  return (
    <div className="tournament-stage" data-testid="bracket-tour-film">
      <OpeningBracketTour
        data={data}
        teams={teams}
        faceUrlByTeamId={Object.fromEntries(teams.map((team) => [team.id, team.faces]))}
        labelByTeamId={Object.fromEntries(teams.map((team) => [team.id, team.name]))}
        memberNamesByTeamId={Object.fromEntries(teams.map((team) => [team.id, team.members]))}
      />
    </div>
  );
}
