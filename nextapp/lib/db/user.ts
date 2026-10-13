import { prisma } from "../prisma"

type Tokens = { 
    refresh_token:string,
    access_token:string,
    userId:number,
    expires_in:number,
}
type SpotifyTokenData = Omit<Tokens, "userId">;
export const saveTwitchTokens = async(data:Tokens) =>{ 
    const expiresAt = new Date(Date.now() + data.expires_in * 1000)
    return await prisma.user.update({
        where:{
            id: data.userId
        },
        data:{
            twitch_rt:data.refresh_token,
            twitch_at:data.access_token,
            twitch_exp:expiresAt,
        }
    })
}

export const getUser = async(userId:number) => {
    return await prisma.user.findUnique({
        where:{
            id:userId
        }
    })
}

export const saveSpotifyTokens = async(data:SpotifyTokenData) => {
    const expiresAt = new Date(Date.now() + data.expires_in * 1000)
    return await prisma.streamOverlayIntegration.upsert({
        where: { id: "streamer" },
        create: {
            id: "streamer",
            spotify_rt: data.refresh_token,
            spotify_at: data.access_token,
            spotify_exp: expiresAt,
        },
        update: {
            spotify_rt: data.refresh_token,
            spotify_at: data.access_token,
            spotify_exp: expiresAt,
        },
    })
}

export const getUserByDiscordId = async(userId:string) => {
    return await prisma.entity.findUnique({
        where:{
            discord_id:userId
        }
    })
}