import {incrementPoints,getUserPoints,} from "./pointsRepository";
import {createUser,getUser} from "../user/userRespository";

export const addPointsToUser = async (userId: string, points: number) => {
    let user = await getUser(userId);
    if (!user) {
        user = await createUser(userId);
    }
    await incrementPoints(userId, points);
    const newPoints = (await getUserPoints(userId)) ?? 0;
    return {success: true, points: newPoints,};
};