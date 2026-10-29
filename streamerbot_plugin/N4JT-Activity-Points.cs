using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using System.Text;

public class CPHInline
{
    private const string TokenVariable = "n4jtStreamerBotToken";
    private const string ActiveUsersVariable = "n4jtActivityPointsActiveUsers";
    private const string Endpoint =
        "https://najtik.stream/api/integrations/streamerbot/points";
    private const long ActiveWindowMilliseconds = 5 * 60 * 1000;

    private static readonly object StateLock = new object();
    private static readonly HttpClient Http = new HttpClient();
    private static Dictionary<string, ActiveUser> activeUsers;
    private static bool stateLoaded;

    public bool Execute()
    {
        if (TryGetArgument(args, "userId", out string userId) &&
            !string.IsNullOrWhiteSpace(userId))
        {
            return RecordActivity(userId);
        }

        return AwardActiveUsers();
    }

    private bool RecordActivity(string userId)
    {
        if (!IsTwitchUserId(userId))
        {
            CPH.LogError("Activity points: chat trigger did not provide a valid Twitch userId.");
            return false;
        }

        bool hasSubscriberArgument =
            TryGetArgument(args, "isSubscribed", out string subscriberValue) ||
            TryGetArgument(args, "isSubscriber", out subscriberValue);
        if (!hasSubscriberArgument ||
            !bool.TryParse(subscriberValue, out bool isSubscriber))
        {
            CPH.LogError(
                "Activity points: chat trigger did not provide a valid isSubscribed or isSubscriber argument.");
            return false;
        }

        lock (StateLock)
        {
            if (!LoadState())
            {
                return false;
            }

            activeUsers[userId] = new ActiveUser
            {
                LastMessageAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                IsSubscriber = isSubscriber,
            };
            SaveState();
        }

        return true;
    }

    private bool AwardActiveUsers()
    {
        string token = CPH.GetGlobalVar<string>(TokenVariable, true);
        if (string.IsNullOrWhiteSpace(token))
        {
            CPH.LogError(
                "Activity points: persistent global variable n4jtStreamerBotToken is missing.");
            return false;
        }

        List<KeyValuePair<string, ActiveUser>> eligibleUsers;
        long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        long cutoff = now - ActiveWindowMilliseconds;

        lock (StateLock)
        {
            if (!LoadState())
            {
                return false;
            }

            eligibleUsers = new List<KeyValuePair<string, ActiveUser>>();
            var inactiveUserIds = new List<string>();

            foreach (KeyValuePair<string, ActiveUser> entry in activeUsers)
            {
                if (entry.Value.LastMessageAt >= cutoff)
                {
                    eligibleUsers.Add(entry);
                }
                else
                {
                    inactiveUserIds.Add(entry.Key);
                }
            }

            foreach (string inactiveUserId in inactiveUserIds)
            {
                activeUsers.Remove(inactiveUserId);
            }

            if (inactiveUserIds.Count > 0)
            {
                SaveState();
            }
        }

        long fiveMinuteBucket = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 300;
        bool succeeded = true;
        foreach (KeyValuePair<string, ActiveUser> entry in eligibleUsers)
        {
            int points = entry.Value.IsSubscriber ? 65 : 50;
            string eventId =
                "activity-" +
                fiveMinuteBucket.ToString(CultureInfo.InvariantCulture) +
                "-" +
                entry.Key;
            string json =
                "{\"eventId\":\"" + eventId +
                "\",\"twitchUserId\":\"" + entry.Key +
                "\",\"delta\":" + points.ToString(CultureInfo.InvariantCulture) +
                "}";

            using (var request = new HttpRequestMessage(HttpMethod.Post, Endpoint))
            {
                request.Headers.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");

                try
                {
                    using (HttpResponseMessage response =
                        Http.SendAsync(request).GetAwaiter().GetResult())
                    {
                        if (!response.IsSuccessStatusCode)
                        {
                            succeeded = false;
                            string responseBody =
                                response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                            CPH.LogError(
                                $"Activity points: API returned {(int)response.StatusCode} " +
                                $"for Twitch user {entry.Key}: {responseBody}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    succeeded = false;
                    CPH.LogError(
                        $"Activity points: request failed for Twitch user {entry.Key}: {ex}");
                }
            }
        }

        return succeeded;
    }

    private bool LoadState()
    {
        if (stateLoaded)
        {
            return true;
        }

        string storedState =
            CPH.GetGlobalVar<string>(ActiveUsersVariable, true);
        if (string.IsNullOrWhiteSpace(storedState))
        {
            activeUsers = new Dictionary<string, ActiveUser>();
        }
        else
        {
            string[] records = storedState.Split(';');
            if (records.Length == 0 || records[0] != "v1")
            {
                CPH.LogError(
                    "Activity points: saved activity data has an unsupported format. " +
                    "Clear the persistent global variable n4jtActivityPointsActiveUsers and retry.");
                return false;
            }

            activeUsers = new Dictionary<string, ActiveUser>();
            for (int i = 1; i < records.Length; i++)
            {
                if (records[i].Length == 0)
                {
                    continue;
                }

                string[] fields = records[i].Split(',');
                if (fields.Length != 3 ||
                    !IsTwitchUserId(fields[0]) ||
                    !long.TryParse(
                        fields[1],
                        NumberStyles.None,
                        CultureInfo.InvariantCulture,
                        out long lastMessageAt) ||
                    (fields[2] != "0" && fields[2] != "1"))
                {
                    CPH.LogError(
                        "Activity points: saved activity data is invalid. " +
                        "Clear the persistent global variable n4jtActivityPointsActiveUsers and retry.");
                    return false;
                }

                activeUsers[fields[0]] = new ActiveUser
                {
                    LastMessageAt = lastMessageAt,
                    IsSubscriber = fields[2] == "1",
                };
            }
        }

        stateLoaded = true;
        return true;
    }

    private void SaveState()
    {
        var serialized = new StringBuilder("v1");
        foreach (KeyValuePair<string, ActiveUser> entry in activeUsers)
        {
            serialized.Append(';')
                .Append(entry.Key)
                .Append(',')
                .Append(entry.Value.LastMessageAt.ToString(CultureInfo.InvariantCulture))
                .Append(',')
                .Append(entry.Value.IsSubscriber ? '1' : '0');
        }
        CPH.SetGlobalVar(ActiveUsersVariable, serialized.ToString(), true);
    }

    private bool IsTwitchUserId(string userId)
    {
        if (string.IsNullOrEmpty(userId) || userId.Length > 32)
        {
            return false;
        }

        foreach (char character in userId)
        {
            if (character < '0' || character > '9')
            {
                return false;
            }
        }

        return true;
    }

    private bool TryGetArgument(
        Dictionary<string, object> actionArgs,
        string name,
        out string value)
    {
        value = null;
        if (!actionArgs.TryGetValue(name, out object rawValue) || rawValue == null)
        {
            return false;
        }

        value = Convert.ToString(rawValue);
        return !string.IsNullOrWhiteSpace(value);
    }

    private sealed class ActiveUser
    {
        public long LastMessageAt { get; set; }
        public bool IsSubscriber { get; set; }
    }
}
