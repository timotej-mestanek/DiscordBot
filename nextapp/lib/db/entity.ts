import { prisma } from '@/lib/prisma'
import { Entity } from '@prisma/client';

export const loadEntityByName = async(name:string)=>{ 
    return await prisma.entity.findFirst({
        where:{
            name,
        }
    });
}
export const loadEntityByTwitchId = async(twitch_id:string)=>{ 
    return await prisma.entity.findFirst({
        where:{
            twitch_id,
        }
    });
}

export const createEntity = async(name:string,twitch_id?:string) =>{ 
    try{
        const user = await prisma.entity.create({
            data:{
                name,
                twitch_id
            }
        })
        return user;
    }catch(err){
        console.log(err);
        return null; 
    }
}

export const updateEntity = async(name:string,twitch_id:string)=>{ 
   const user = await loadEntityByName(name);
   if(user && user.id){ 
    return await prisma.entity.update({
        where:{
            id:user.id
        },
        data:{
            twitch_id
        }
    })
   }
   return null;
}


