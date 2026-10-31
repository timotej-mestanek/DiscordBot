using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;

public class CPHInline
{
    private const string TokenVariable = "n4jtStreamerBotToken";
    private const string Endpoint =
        "https://najtik.stream/api/integrations/streamerbot/follow";

    private static readonly HttpClient Http = new HttpClient();

    public bool Execute()
    {
        if (!TryGetArgument(args, "userId", out string userId) ||
            !IsTwitchUserId(userId))
        {
            CPH.LogError("Follow users: Twitch Follow trigger did not provide a valid userId.");
            return false;
        }

        if (!TryGetArgument(args, "userName", out string displayName) &&
            !TryGetArgument(args, "displayName", out displayName) &&
            !TryGetArgument(args, "user_name", out displayName) &&
            !TryGetArgument(args, "username", out displayName))
        {
            CPH.LogError("Follow users: Twitch Follow trigger did not provide a display name.");
            return false;
        }

        displayName = displayName.Trim();
        if (displayName.Length > 80)
        {
            CPH.LogError("Follow users: Twitch display name exceeds 80 characters.");
            return false;
        }

        string eventId;
        if (!TryGetArgument(args, "eventId", out eventId) &&
            !TryGetArgument(args, "followEventId", out eventId) &&
            !TryGetArgument(args, "event_id", out eventId) &&
            !TryGetArgument(args, "id", out eventId))
        {
            eventId =
                "follow-" + userId + "-" +
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(
                    CultureInfo.InvariantCulture);
        }
        eventId = eventId.Trim();
        if (eventId.Length > 200)
        {
            CPH.LogError("Follow users: Streamer.bot event ID exceeds 200 characters.");
            return false;
        }

        string token = CPH.GetGlobalVar<string>(TokenVariable, true);
        if (string.IsNullOrWhiteSpace(token))
        {
            CPH.LogError(
                "Follow users: persistent global variable n4jtStreamerBotToken is missing.");
            return false;
        }

        string json =
            "{\"eventId\":\"" + EscapeJson(eventId) +
            "\",\"userId\":\"" + EscapeJson(userId) +
            "\",\"displayName\":\"" + EscapeJson(displayName) + "\"}";

        using (var request = new HttpRequestMessage(HttpMethod.Post, Endpoint))
        {
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                using (HttpResponseMessage response =
                    Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        string responseBody =
                            response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                        CPH.LogError(
                            $"Follow users: API returned {(int)response.StatusCode}: {responseBody}");
                        return false;
                    }
                }
            }
            catch (Exception ex)
            {
                CPH.LogError("Follow users: request failed: " + ex);
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

    private string EscapeJson(string value)
    {
        var escaped = new StringBuilder(value.Length);
        foreach (char character in value)
        {
            switch (character)
            {
                case '"':
                    escaped.Append("\\\"");
                    break;
                case '\\':
                    escaped.Append("\\\\");
                    break;
                case '\b':
                    escaped.Append("\\b");
                    break;
                case '\f':
                    escaped.Append("\\f");
                    break;
                case '\n':
                    escaped.Append("\\n");
                    break;
                case '\r':
                    escaped.Append("\\r");
                    break;
                case '\t':
                    escaped.Append("\\t");
                    break;
                default:
                    if (character < 0x20)
                    {
                        escaped.Append("\\u");
                        escaped.Append(((int)character).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        escaped.Append(character);
                    }
                    break;
            }
        }

        return escaped.ToString();
    }
}
