import { createEntity, loadEntityByName, loadEntityByTwitchId, updateEntity } from "@/lib/db/entity";
import { createStat } from "@/lib/db/stats";
import { getStream } from "@/lib/services/twitchService";
import { getUserFromString } from "@/lib/thirdparty/twitch";
import { Command } from "@/lib/types";


export async function GET(){ 
    const data = await getStream("n4jtik",1);
    return Response.json({
        data
    })
}


export async function POST(req:Request) { 
    const data:Command = await req.json();
    const split = data.command.split(" ");
    const userName = await getUserFromString(split[2]);
    let user = userName && userName.mod === "twitch_id" ? await loadEntityByTwitchId(userName.name) : userName ? await loadEntityByName(userName.name) : null;
    if(!user){
        console.log("toto je userName:",userName);
       const create = userName && userName.mod === "twitch_id" ? await createEntity(split[2].slice(1), userName.name) : userName? await createEntity(userName.name) : null;
       if(!create){
        const update = await updateEntity(split[2].slice(1), userName.name);  
        if(!update){
            return Response.json({"error":"neco se fakt moc nepovedlo"}); 
        }    
        user = update;
       }else{
        user = create;
       }
    }
    switch(split[1]){
        case "say":
            const data = await createStat(user.id, 1);
            return Response.json({"test":data});
        case "create":
            return Response.json({"d":"d"});
        case "active": 
            
        default:
            return Response.json({
        "lul":"nah"
        })
    }

}