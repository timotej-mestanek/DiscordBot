import GamblingGame from "../games/roulette";
import getUserPoints, { addPoints } from "../services/pointsService";
import { DMes } from "../types/types";

export const commands = [
    { keyword: "!ruleta", allowedChannels: ["1465861802012442810"], action: (message:DMes) =>  GamblingGame(message)},
    { keyword: "shop", action: () => console.log("shop") },
    {keyword: "inventory", action: () => console.log("inventory") },
    {keyword: "addpoints", action:async (message:DMes) => {return await addPoints(message.author.id, 10056)}},
    {keyword: "!points", action: async (message:DMes) => {return "Tvoje body: " + await getUserPoints(message.author.id)}}
];