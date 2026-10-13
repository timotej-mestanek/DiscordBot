export type Command = {
    command:string,
}

export type TwitchUser = {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
    broadcaster_type: string;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    view_count: number;
    created_at: string;
  }> ;
};
export type TwitchError ={
    error:string,
    status:number,
    message:string,
}

export type UserResult =
  | { mod: "twitch_id"; name: string }
  | { mod: "name"; name: string; warn?: string };

  export type StatsMode = "daily" | "season" | "fulltime";

  
export type GetStatsParams = {
  mode: StatsMode;
  limit?: number;
  isActive?:[];
};
