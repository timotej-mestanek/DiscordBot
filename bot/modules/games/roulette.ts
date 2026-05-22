import { Message, OmitPartialGroupDMChannel } from "discord.js";
import { generateResponse } from "../../discord/events/messageHandler";
import { createUser, getUser } from "../user/userRespository";
import  {getUserPoints, decrementPoints, incrementPoints } from "../points/";

type Selection = number | "red" | "black" | "green";

export default async function GamblingGame(message: OmitPartialGroupDMChannel<Message<boolean>>) {
    try {
        const args = message.content.trim().split(/\s+/);
        const value = Number(args[1]);
        const choiceRaw = args[2];

        if (!choiceRaw || isNaN(value) || value <= 0) {
            await message.channel.send("Neplatna hodnota strapata cernota");
            return;
        }

        let user = await getUser(message.author.id);
        if (!user) {
            await createUser(message.author.id);
            user = await getUser(message.author.id); 
        }

        const userPoints = await getUserPoints(message.author.id);
        if ((userPoints ?? 0) < value) {
            await message.channel.send(`Co jsou to body kurva (Nemáš dost bodů, pouze ${userPoints}) `);
            return;
        }

        const selection = convertChoice(choiceRaw);
        if (selection === null) {
            await message.channel.send("To nevis vybrat dobry choice panenko marjo");
            return;
        }

        const winNumber = Math.floor(Math.random() * 37);
        const winResult = determineResult(selection, winNumber);

        const dropSymbol = getDropSymbol(winNumber);
        const messageToSend = winResult ? generateResponse("win") : generateResponse("lose");
        let pointsChange; 
        
        if(winResult){
            if(selection === "green"){
                pointsChange = value * 35;
            }else{
                pointsChange = value * 2;
            }
            await incrementPoints(message.author.id, pointsChange);            
        }else{
            pointsChange = -value;
            await decrementPoints(message.author.id, pointsChange);
        }
        await message.channel.send(`${dropSymbol.repeat(4)} ${messageToSend} ${dropSymbol.repeat(4)}. ${winResult? "Vyhrál jsi ":"Prohrál jsi "}${pointsChange} bodů teď máš ${await getUserPoints(message.author.id)} bodů`);

    } catch (err) {
        console.error(err);
        await message.channel.send("Neco sa asi uplne nepovedlo bracho");
    }
}

function convertChoice(s: string): Selection | null {
    s = s.toLowerCase();

 
    const n = Number(s);
    if (!isNaN(n) && n >= 0 && n <= 36) return n;

    const firstChar = s[0];
    if (firstChar === "z" || firstChar === "g") return "green";
    if (firstChar === "r") return "red";
    if(firstChar === "b") return "black";
    if (firstChar === "c") {
        const fourthChar = s[3];
        if (fourthChar === "v") return "red";     
        if (fourthChar === "n") return "black"; 
    }

    return null; 
}

function determineResult(selection: Selection, winNumber: number): boolean {
    if (typeof selection === "number") return selection === winNumber;
    if (winNumber === 0) return selection === "green";
    if (winNumber % 2 === 0) return selection === "red";
    return selection === "black";
}

function getDropSymbol(winNumber: number): string {
    if (winNumber === 0) return "🟢";
    if (winNumber % 2 === 0) return "🔴";
    return "⚫";
}
