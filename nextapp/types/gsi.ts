export interface GSIWeapon {
  name: string; 
  paintkit?: string; 
  type: "Knife" | "Pistol" | "Rifle" | "Submachine Gun" | "Shotgun" | "Sniper Rifle" | "Grenade" | "C4" | "Taser" | "Other";
  ammo_clip?: number;
  ammo_clip_max?: number;
  ammo_reserve?: number;
  state: "holstered" | "active" | "reloading";
}

export interface GSIPlayerState {
  health?: number;
  armor?: number;
  helmet?: boolean;
  flashed?: number;
  smoked?: number;
  burning?: number;
  money?: number;
  round_kills?: number;
  round_killhs?: number;
  equip_value?: number;
}

export interface GSIPlayer {
  steamid?: string;
  name?: string;
  observer_slot?: number;
  team?: "T" | "CT";
  activity?: string;
  state?: GSIPlayerState;
  weapons?: {
    [weaponKey: string]: GSIWeapon;
  };
  match_stats?: {
    kills?: number;
    assists?: number;
    deaths?: number;
    mvps?: number;
    score?: number;
  };
}

export interface GSITeam {
  score?: number;
  consecutive_round_losses?: number;
  timeouts_remaining?: number;
  matches_won_this_series?: number;
}

export interface GSIMap {
  mode?: string;
  name?: string;
  phase?: string;
  round?: number;
  team_ct?: GSITeam;
  team_t?: GSITeam;
  num_matches_to_win_series?: number;
}

export interface GSIProvider {
  name?: string;
  appid?: number;
  version?: number;
  steamid?: string;
  timestamp?: number;
}

export interface GSIData {
  provider?: GSIProvider;
  map?: GSIMap;
  round?: {
    phase?: string;
  };
  player?: GSIPlayer;
  previously?: {
    player?: {
      weapons?: {
        [weaponKey: string]: {
          state?: "holstered" | "active" | "reloading";
        };
      };
    };
  };
  auth?: {
    [key: string]: string;
  };
}