import type {
  ProviderPlayer,
  ProviderSeason,
} from '../providers/provider.types.js';

export type MutationKind = 'created' | 'unchanged' | 'updated';

export interface ReferenceTeamInput {
  abbreviation: string;
  city: string;
  externalId: string;
  name: string;
}

export interface ReferenceSnapshotInput {
  league: {
    code: 'NHL';
    externalId: string;
    name: 'National Hockey League';
  };
  season: ProviderSeason;
  teams: readonly ReferenceTeamInput[];
}

export interface ReferenceSnapshotResult {
  mutations: readonly MutationKind[];
}

export interface RosterContext {
  seasonExternalId: string;
  seasonId: string;
  teams: readonly {
    abbreviation: string;
    externalId: string;
    id: string;
  }[];
}

export interface RosterPlayerInput {
  player: ProviderPlayer;
  teamId: string;
}
