import GamblingGame from "../../modules/games/roulette";
import  {getUserPoints, addPointsToUser } from "../../modules/points";
import { DMes } from "../../types/types";


export const commands = [
    {keyword: "!ruleta", allowedChannels: ["1465861802012442810"], action: (message:DMes) =>  GamblingGame(message)},
    {keyword: "!shop", action: () => console.log("shop") }, // TODO
    {keyword: "!inventory", action: () => console.log("inventory") }, // TODO 
    {keyword: "!addpoints", action:async (message:DMes) => {return await addPointsToUser(message.author.id, 10056)}},
    {keyword: "!points", action: async (message:DMes) => {return "Tvoje body: " + await getUserPoints(message.author.id)}}
];

