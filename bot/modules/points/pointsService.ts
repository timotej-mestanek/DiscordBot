import { incrementPoints, getUserPoints } from "./pointsRepository";
import { ensureUser } from "../user/userRespository";

export const addPointsToUser = async (
    userId: string,
    points: number,
    name = "",
) => {
    if (!Number.isSafeInteger(points) || points <= 0) {
        throw new RangeError("Počet bodů musí být kladné celé číslo.");
    }
    await ensureUser(userId, name);
    await incrementPoints(userId, points);
    const newPoints = (await getUserPoints(userId)) ?? 0;
    return { success: true, points: newPoints };
};