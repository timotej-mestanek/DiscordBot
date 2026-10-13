import { getValidTwitchToken } from "@/lib/oauth/twitch"

export async function getTwitchUser(userId: number) {
    try{
  const token = await getValidTwitchToken(userId)

  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!
    }
  })

  return res.json()
    }catch(err){
        console.log(err);
        return {err:err};
    }

}

export async function getEntityId(userId:number, name:string){
    try{
    const token = await getValidTwitchToken(userId); 
    const res = await fetch(`https://api.twitch.tv/helix/users?login=${name}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!
    }
  })
     return res.json();
    }catch(err){
        console.log(err);
        return null;
    }
}

export async function getStream(user_login: string, userId: number) {
  try {
    const token = await getValidTwitchToken(userId);

    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${user_login}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID!
        }
      }
    );

    const json = await res.json();

    if (!json.data || json.data.length === 0) {
      return {
        live: false,
        startedAt: null,
        uptimeSeconds: 0
      };
    }

    const stream = json.data[0];
    const startedAt = new Date(stream.started_at);
    const now = new Date();

    const uptimeSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

    return {
      live: true,
      startedAt: stream.started_at,   
      uptimeSeconds,                  
      title: stream.title,
      viewerCount: stream.viewer_count
    };

  } catch (err) {
    console.error(err);
    return null;
  }
}