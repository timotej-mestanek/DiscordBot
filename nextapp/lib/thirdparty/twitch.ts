import { getEntityId } from "../services/twitchService";
import { TwitchError, TwitchUser, UserResult } from "../types";

export const getUserFromString = async(name: string): Promise<UserResult> => {
    if (name.startsWith("@")) {
        const twitchIdOfUser: TwitchUser | TwitchError = await getEntityId(1, name.slice(1));
        console.log("tady to pada:",twitchIdOfUser)
        if ('error' in twitchIdOfUser) {
            return { mod: "name", name, warn: `Twitch API error: ${twitchIdOfUser.message}` };
        }

        const id = twitchIdOfUser.data?.[0]?.id;
        if (!id) {
            return { mod: "name", name, warn: `nenasilo sa id pre ${name}, oznacil si ho spravne?` };
        }

        return { mod: "twitch_id", name: id };
    } else {
        return { mod: "name", name };
    }
}
