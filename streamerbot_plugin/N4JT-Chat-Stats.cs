using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    private const string TokenVariable = "n4jtStreamerBotToken";
    private const string StateVariable = "n4jtChatStatsState";
    private const string WordDatasetVariable = "n4jtChatStatsWordDataset";
    private const string ExtraEmotesVariable = "n4jtChatStatsExtraEmotes";
    private const string MetricsEndpoint =
        "https://najtik.stream/api/integrations/streamerbot/chat-metrics";
    private const string EmotesEndpoint = "https://najtik.stream/emotes-map.json";
    private const int MaxCount = 1_000_000;

    private static readonly object StateLock = new object();
    private static readonly object DatasetLock = new object();
    private static readonly object EmotesLock = new object();
    private static readonly HttpClient Http = CreateHttpClient();
    private static StatsState state;
    private static bool stateLoaded;
    private static string cachedWordDataset;
    private static List<Regex> cachedWordPatterns;
    private static Dictionary<string, HashSet<string>> emotesByUser =
        new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
    private static DateTime emotesExpireAt = DateTime.MinValue;

    public bool Execute()
    {
        if (TryGetArgument(args, "userId", out string userId))
        {
            return RecordMessage(userId);
        }

        return FlushMetrics();
    }

    private bool RecordMessage(string userId)
    {
        if (!IsTwitchUserId(userId))
        {
            CPH.LogError("Chat stats: Twitch chat trigger did not provide a valid userId.");
            return false;
        }
        if (!TryGetArgument(args, "message", out string message) &&
            !TryGetArgument(args, "messageStripped", out message))
        {
            CPH.LogError("Chat stats: Twitch chat trigger did not provide a message.");
            return false;
        }

        string displayName;
        if (!TryGetArgument(args, "userName", out displayName) &&
            !TryGetArgument(args, "displayName", out displayName) &&
            !TryGetArgument(args, "user_name", out displayName) &&
            !TryGetArgument(args, "username", out displayName))
        {
            displayName = userId;
        }
        displayName = displayName.Trim();
        if (displayName.Length > 80)
        {
            displayName = displayName.Substring(0, 80);
        }

        if (!TryGetWordPatterns(out List<Regex> wordPatterns))
        {
            return false;
        }

        string username = displayName.ToLowerInvariant();
        HashSet<string> emotes = GetEmotesForUser(username);
        int emoteCount = CountEmotes(message, emotes);
        string textWithoutEmotes = RemoveEmotes(message, emotes);
        int wordCount = CountWords(textWithoutEmotes);
        int profanityCount = CountDatasetMatches(textWithoutEmotes, wordPatterns);

        lock (StateLock)
        {
            if (!LoadState())
            {
                return false;
            }

            if (!state.Pending.TryGetValue(userId, out UserMetrics metrics))
            {
                metrics = new UserMetrics();
                state.Pending[userId] = metrics;
            }

            if (!CanAdd(metrics.MessageCount, 1) ||
                !CanAdd(metrics.WordCount, wordCount) ||
                !CanAdd(metrics.ProfanityCount, profanityCount) ||
                !CanAdd(metrics.EmoteCount, emoteCount))
            {
                CPH.LogError(
                    "Chat stats: pending counts exceeded the supported integer range for user " +
                    userId + ".");
                return false;
            }

            metrics.DisplayName = displayName;
            metrics.MessageCount += 1;
            metrics.WordCount += wordCount;
            metrics.ProfanityCount += profanityCount;
            metrics.EmoteCount += emoteCount;
            SaveState();
        }

        return true;
    }

    private bool FlushMetrics()
    {
        string token = CPH.GetGlobalVar<string>(TokenVariable, true);
        if (string.IsNullOrWhiteSpace(token))
        {
            CPH.LogError(
                "Chat stats: persistent global variable n4jtStreamerBotToken is missing.");
            return false;
        }

        List<MetricBatch> batches;
        lock (StateLock)
        {
            if (!LoadState())
            {
                return false;
            }

            foreach (KeyValuePair<string, UserMetrics> entry in state.Pending)
            {
                state.InFlight.Add(new MetricBatch
                {
                    EventId = "chat-stats-" + Guid.NewGuid().ToString("N"),
                    UserId = entry.Key,
                    DisplayName = entry.Value.DisplayName,
                    MessageCount = entry.Value.MessageCount,
                    WordCount = entry.Value.WordCount,
                    ProfanityCount = entry.Value.ProfanityCount,
                    EmoteCount = entry.Value.EmoteCount,
                });
            }
            state.Pending.Clear();
            SaveState();
            batches = new List<MetricBatch>(state.InFlight);
        }

        bool succeeded = true;
        foreach (MetricBatch batch in batches)
        {
            if (!PostBatch(token, batch))
            {
                succeeded = false;
                continue;
            }

            lock (StateLock)
            {
                if (!LoadState())
                {
                    succeeded = false;
                    continue;
                }

                state.InFlight.RemoveAll(
                    pending => pending.EventId == batch.EventId);
                SaveState();
            }
        }

        return succeeded;
    }

    private bool PostBatch(string token, MetricBatch batch)
    {
        var payload = new
        {
            eventId = batch.EventId,
            platform = "twitch",
            userId = batch.UserId,
            displayName = batch.DisplayName,
            messageCount = batch.MessageCount,
            wordCount = batch.WordCount,
            profanityCount = batch.ProfanityCount,
            emoteCount = batch.EmoteCount,
        };

        using (var request = new HttpRequestMessage(HttpMethod.Post, MetricsEndpoint))
        {
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
            request.Content = new StringContent(
                JsonConvert.SerializeObject(payload),
                Encoding.UTF8,
                "application/json");

            try
            {
                using (HttpResponseMessage response =
                    Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    if (response.IsSuccessStatusCode)
                    {
                        return true;
                    }

                    string responseBody =
                        response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                    CPH.LogError(
                        $"Chat stats: API returned {(int)response.StatusCode} for Twitch user " +
                        $"{batch.UserId}: {responseBody}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                CPH.LogError(
                    $"Chat stats: request failed for Twitch user {batch.UserId}: {ex}");
                return false;
            }
        }
    }

    private bool TryGetWordPatterns(out List<Regex> patterns)
    {
        patterns = null;
        string dataset = CPH.GetGlobalVar<string>(WordDatasetVariable, true);
        if (string.IsNullOrWhiteSpace(dataset))
        {
            CPH.LogError(
                "Chat stats: persistent global variable n4jtChatStatsWordDataset is missing. " +
                "Copy the profanity dataset into it before enabling chat stats.");
            return false;
        }

        lock (DatasetLock)
        {
            if (dataset == cachedWordDataset && cachedWordPatterns != null)
            {
                patterns = cachedWordPatterns;
                return true;
            }

            var compiledPatterns = new List<Regex>();
            string[] lines = dataset.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
            for (int i = 0; i < lines.Length; i++)
            {
                string line = lines[i].Trim();
                if (line.Length == 0 || line.StartsWith("#", StringComparison.Ordinal))
                {
                    continue;
                }

                string term = line;
                if (line.Contains("|"))
                {
                    string[] fields = line.Split('|');
                    if (fields.Length != 3 ||
                        !Regex.IsMatch(fields[1].Trim(), "^[1-9][0-9]*$"))
                    {
                        CPH.LogError(
                            "Chat stats: invalid word dataset entry on line " +
                            (i + 1).ToString(CultureInfo.InvariantCulture) + ".");
                        return false;
                    }
                    term = fields[2].Trim();
                }

                string normalizedTerm = Regex.Replace(Normalize(term), @"\s+", " ");
                if (normalizedTerm.Length == 0)
                {
                    CPH.LogError(
                        "Chat stats: empty word dataset entry on line " +
                        (i + 1).ToString(CultureInfo.InvariantCulture) + ".");
                    return false;
                }

                string[] words = Regex.Split(
                    normalizedTerm,
                    "\\s+",
                    RegexOptions.None);
                string expression =
                    @"(?<![\p{L}\p{N}])" +
                    string.Join(@"\s+", Array.ConvertAll(words, Regex.Escape)) +
                    @"(?![\p{L}\p{N}])";
                compiledPatterns.Add(
                    new Regex(expression, RegexOptions.CultureInvariant));
            }

            if (compiledPatterns.Count == 0)
            {
                CPH.LogError("Chat stats: the word dataset contains no usable entries.");
                return false;
            }

            cachedWordDataset = dataset;
            cachedWordPatterns = compiledPatterns;
            patterns = compiledPatterns;
            return true;
        }
    }

    private int CountWords(string message)
    {
        return Regex.Matches(
            message,
            @"[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*",
            RegexOptions.CultureInvariant).Count;
    }

    private int CountDatasetMatches(string message, List<Regex> patterns)
    {
        string normalizedMessage = Normalize(message);
        int count = 0;
        foreach (Regex pattern in patterns)
        {
            count += pattern.Matches(normalizedMessage).Count;
        }
        return count;
    }

    private HashSet<string> GetEmotesForUser(string username)
    {
        RefreshEmotesMap();
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        string normalizedUsername = username.Trim().ToLowerInvariant();

        lock (EmotesLock)
        {
            if (emotesByUser.TryGetValue(normalizedUsername, out HashSet<string> userEmotes))
            {
                result.UnionWith(userEmotes);
            }
        }

        string extraEmotes = CPH.GetGlobalVar<string>(ExtraEmotesVariable, true);
        if (!string.IsNullOrWhiteSpace(extraEmotes))
        {
            try
            {
                JArray names = JArray.Parse(extraEmotes);
                foreach (JToken name in names)
                {
                    if (name.Type == JTokenType.String)
                    {
                        AddEmote(result, name.Value<string>());
                    }
                }
            }
            catch (JsonException ex)
            {
                CPH.LogError(
                    "Chat stats: n4jtChatStatsExtraEmotes must be a JSON array of emote names: " +
                    ex.Message);
            }
        }

        return result;
    }

    private void RefreshEmotesMap()
    {
        lock (EmotesLock)
        {
            if (DateTime.UtcNow < emotesExpireAt)
            {
                return;
            }
            emotesExpireAt = DateTime.UtcNow.AddSeconds(30);

            try
            {
                using (HttpResponseMessage response =
                    Http.GetAsync(EmotesEndpoint).GetAwaiter().GetResult())
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        CPH.LogError(
                            "Chat stats: emote map request returned HTTP " +
                            ((int)response.StatusCode).ToString(CultureInfo.InvariantCulture) + ".");
                        return;
                    }

                    string json =
                        response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                    JObject root = JObject.Parse(json);
                    var refreshed = new Dictionary<string, HashSet<string>>(
                        StringComparer.OrdinalIgnoreCase);

                    foreach (JProperty user in root.Properties())
                    {
                        if (!(user.Value is JArray emotes))
                        {
                            continue;
                        }

                        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        foreach (JToken emote in emotes)
                        {
                            if (emote is JObject item &&
                                item["t"] != null &&
                                item["t"].Type == JTokenType.String)
                            {
                                AddEmote(names, item["t"].Value<string>());
                            }
                        }
                        refreshed[user.Name.Trim().ToLowerInvariant()] = names;
                    }

                    emotesByUser = refreshed;
                }
            }
            catch (Exception ex)
            {
                CPH.LogError("Chat stats: could not refresh the emote map: " + ex.Message);
            }
        }
    }

    private int CountEmotes(string message, HashSet<string> emotes)
    {
        int count = 0;
        foreach (string emote in emotes)
        {
            string expression = EmotePattern(emote);
            count += Regex.Matches(
                message,
                expression,
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant).Count;
        }
        return count;
    }

    private string RemoveEmotes(string message, HashSet<string> emotes)
    {
        string result = message;
        foreach (string emote in emotes)
        {
            result = Regex.Replace(
                result,
                EmotePattern(emote),
                " ",
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        }
        return result;
    }

    private string EmotePattern(string emote)
    {
        return @"(?<!\S)" + Regex.Escape(emote) + @"(?!\S)";
    }

    private string Normalize(string value)
    {
        string decomposed = value.Normalize(NormalizationForm.FormD);
        var normalized = new StringBuilder(decomposed.Length);
        foreach (char character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) !=
                UnicodeCategory.NonSpacingMark)
            {
                normalized.Append(character);
            }
        }
        return normalized.ToString().ToLowerInvariant().Trim();
    }

    private void AddEmote(HashSet<string> emotes, string value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            emotes.Add(value.Trim());
        }
    }

    private bool LoadState()
    {
        if (stateLoaded)
        {
            return true;
        }

        string stored = CPH.GetGlobalVar<string>(StateVariable, true);
        if (string.IsNullOrWhiteSpace(stored))
        {
            state = new StatsState();
        }
        else
        {
            try
            {
                state = JsonConvert.DeserializeObject<StatsState>(stored);
                if (state == null)
                {
                    throw new InvalidDataException("Saved stats are empty.");
                }
            }
            catch (Exception ex)
            {
                CPH.LogError(
                    "Chat stats: saved state is invalid; clear n4jtChatStatsState to reset it. " +
                    ex.Message);
                return false;
            }
        }

        if (state.Pending == null)
        {
            state.Pending = new Dictionary<string, UserMetrics>();
        }
        if (state.InFlight == null)
        {
            state.InFlight = new List<MetricBatch>();
        }

        foreach (KeyValuePair<string, UserMetrics> entry in state.Pending)
        {
            if (!IsTwitchUserId(entry.Key) ||
                !IsValidMetrics(entry.Value))
            {
                CPH.LogError("Chat stats: saved pending statistics are invalid.");
                return false;
            }
        }
        foreach (MetricBatch batch in state.InFlight)
        {
            if (batch == null ||
                string.IsNullOrWhiteSpace(batch.EventId) ||
                batch.EventId.Length > 200 ||
                !IsTwitchUserId(batch.UserId) ||
                string.IsNullOrWhiteSpace(batch.DisplayName) ||
                batch.DisplayName.Length > 80 ||
                !IsValidCount(batch.MessageCount) ||
                !IsValidCount(batch.WordCount) ||
                !IsValidCount(batch.ProfanityCount) ||
                !IsValidCount(batch.EmoteCount))
            {
                CPH.LogError("Chat stats: saved in-flight statistics are invalid.");
                return false;
            }
        }

        stateLoaded = true;
        return true;
    }

    private bool IsValidMetrics(UserMetrics metrics)
    {
        return metrics != null &&
            !string.IsNullOrWhiteSpace(metrics.DisplayName) &&
            metrics.DisplayName.Length <= 80 &&
            IsValidCount(metrics.MessageCount) &&
            IsValidCount(metrics.WordCount) &&
            IsValidCount(metrics.ProfanityCount) &&
            IsValidCount(metrics.EmoteCount);
    }

    private bool IsValidCount(int count)
    {
        return count >= 0 && count <= MaxCount;
    }

    private void SaveState()
    {
        CPH.SetGlobalVar(StateVariable, JsonConvert.SerializeObject(state), true);
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

    private bool CanAdd(int current, int addition)
    {
        return addition >= 0 && current <= MaxCount - addition;
    }

    private static HttpClient CreateHttpClient()
    {
        return new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
    }

    private sealed class StatsState
    {
        public Dictionary<string, UserMetrics> Pending { get; set; } =
            new Dictionary<string, UserMetrics>();
        public List<MetricBatch> InFlight { get; set; } =
            new List<MetricBatch>();
    }

    private sealed class UserMetrics
    {
        public string DisplayName { get; set; }
        public int MessageCount { get; set; }
        public int WordCount { get; set; }
        public int ProfanityCount { get; set; }
        public int EmoteCount { get; set; }
    }

    private sealed class MetricBatch
    {
        public string EventId { get; set; }
        public string UserId { get; set; }
        public string DisplayName { get; set; }
        public int MessageCount { get; set; }
        public int WordCount { get; set; }
        public int ProfanityCount { get; set; }
        public int EmoteCount { get; set; }
    }
}
