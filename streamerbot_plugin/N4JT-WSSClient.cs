using System;
using System.Collections.Generic;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    private const string TokenVariable = "n4jtStreamerBotToken";
    private const string ProcessedEventsVariable = "n4jtShopProcessedEventIds";
    private const string Endpoint =
        "wss://najtik.stream/api/integrations/streamerbot/shop/live";
    private const int MaxRememberedEvents = 500;
    private const int MaxMessageBytes = 2 * 1024 * 1024;
    private static readonly object WorkerLock = new object();
    private static Task worker;

    public bool Execute()
    {
        lock (WorkerLock)
        {
            if (worker == null || worker.IsCompleted)
            {
                worker = Task.Run(RunForever);
            }
        }

        return true;
    }

    private async Task RunForever()
    {
        while (true)
        {
            string token = CPH.GetGlobalVar<string>(TokenVariable, true);
            if (string.IsNullOrWhiteSpace(token))
            {
                CPH.LogError(
                    "WSS client: persistent global variable n4jtStreamerBotToken is missing.");
                await Task.Delay(TimeSpan.FromSeconds(5));
                continue;
            }

            try
            {
                using (var socket = new ClientWebSocket())
                {
                    socket.Options.SetRequestHeader("Authorization", "Bearer " + token);
                    await socket.ConnectAsync(new Uri(Endpoint), CancellationToken.None);
                    CPH.LogInfo("N4JT WSS client connected to the app.");
                    await ReceiveEvents(socket);
                }
            }
            catch (Exception ex)
            {
                CPH.LogError("N4JT WSS client connection failed: " + ex.Message);
            }

            await Task.Delay(TimeSpan.FromSeconds(5));
        }
    }

    private async Task ReceiveEvents(ClientWebSocket socket)
    {
        var buffer = new byte[8192];
        while (socket.State == WebSocketState.Open)
        {
            using (var message = new MemoryStream())
            {
                WebSocketReceiveResult result;
                do
                {
                    result = await socket.ReceiveAsync(
                        new ArraySegment<byte>(buffer),
                        CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        return;
                    }
                    if (result.MessageType != WebSocketMessageType.Text ||
                        message.Length + result.Count > MaxMessageBytes)
                    {
                        throw new InvalidDataException("Invalid or oversized shop event.");
                    }
                    message.Write(buffer, 0, result.Count);
                }
                while (!result.EndOfMessage);

                await HandleEvent(socket, Encoding.UTF8.GetString(message.ToArray()));
            }
        }
    }

    private async Task HandleEvent(ClientWebSocket socket, string json)
    {
        string eventId = null;
        try
        {
            JObject root = JObject.Parse(json);
            eventId = ReadString(root, "eventId");
            string actionKey = ReadString(root, "actionKey");
            if (ReadString(root, "type") != "shop-redemption" ||
                string.IsNullOrWhiteSpace(eventId) ||
                string.IsNullOrWhiteSpace(actionKey))
            {
                throw new InvalidDataException("Shop event is missing its type, ID, or action key.");
            }

            if (IsProcessed(eventId))
            {
                await SendAcknowledgement(socket, eventId, true, null);
                return;
            }
            if (!CPH.ActionExists(actionKey))
            {
                throw new InvalidOperationException(
                    "Streamer.bot action does not exist: " + actionKey);
            }

            CPH.SetArgument("shopEventId", eventId);
            CPH.SetArgument("shopEventType", ReadString(root, "type"));
            CPH.SetArgument("shopActionKey", actionKey);
            CPH.SetArgument("shopEventJson", json);
            CPH.SetArgument("shopEffectJson", ReadNestedRawJson(root, "effect"));
            CPH.SetArgument("shopProductId", ReadNestedString(root, "product", "id"));
            CPH.SetArgument("shopProductName", ReadNestedString(root, "product", "name"));
            CPH.SetArgument("shopRedemptionId", ReadString(root, "redemptionId"));
            CPH.SetArgument("shopAccountId", ReadNestedString(root, "account", "id"));
            CPH.SetArgument("shopBuyerDisplayName", ReadNestedString(root, "buyer", "displayName"));
            CPH.SetArgument("shopBuyerProvider", ReadNestedString(root, "buyer", "provider"));
            CPH.SetArgument("shopBuyerProviderUserId", ReadNestedString(root, "buyer", "providerUserId"));
            CPH.SetArgument("shopPaymentCurrency", ReadNestedString(root, "payment", "currency"));
            CPH.SetArgument("shopPaymentAmount", ReadNestedInt(root, "payment", "amount"));

            CPH.RunAction(actionKey, true);
            RememberProcessed(eventId);
            await SendAcknowledgement(socket, eventId, true, null);
        }
        catch (Exception ex)
        {
            CPH.LogError("N4JT WSS event failed: " + ex.Message);
            if (!string.IsNullOrWhiteSpace(eventId))
            {
                try
                {
                    await SendAcknowledgement(socket, eventId, false, ex.Message);
                }
                catch (Exception ackError)
                {
                    CPH.LogError("N4JT WSS event acknowledgement failed: " + ackError.Message);
                }
            }
        }
    }

    private bool IsProcessed(string eventId)
    {
        return LoadProcessedEvents().Contains(eventId);
    }

    private void RememberProcessed(string eventId)
    {
        List<string> eventIds = LoadProcessedEvents();
        eventIds.Remove(eventId);
        eventIds.Add(eventId);
        if (eventIds.Count > MaxRememberedEvents)
        {
            eventIds.RemoveRange(0, eventIds.Count - MaxRememberedEvents);
        }
        CPH.SetGlobalVar(
            ProcessedEventsVariable,
            JsonConvert.SerializeObject(eventIds),
            true);
    }

    private List<string> LoadProcessedEvents()
    {
        string stored = CPH.GetGlobalVar<string>(ProcessedEventsVariable, true);
        if (string.IsNullOrWhiteSpace(stored))
        {
            return new List<string>();
        }

        try
        {
            return JsonConvert.DeserializeObject<List<string>>(stored) ?? new List<string>();
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException(
                "Persistent event IDs are invalid; fix or clear n4jtShopProcessedEventIds.",
                ex);
        }
    }

    private async Task SendAcknowledgement(
        ClientWebSocket socket,
        string eventId,
        bool ok,
        string error)
    {
        var acknowledgement = new Dictionary<string, object>
        {
            { "type", "shop-ack" },
            { "eventId", eventId },
            { "ok", ok },
        };
        if (!string.IsNullOrWhiteSpace(error))
        {
            acknowledgement["error"] = error.Length > 500 ? error.Substring(0, 500) : error;
        }

        byte[] bytes = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(acknowledgement));
        await socket.SendAsync(
            new ArraySegment<byte>(bytes),
            WebSocketMessageType.Text,
            true,
            CancellationToken.None);
    }

    private string ReadString(JToken element, string propertyName)
    {
        JToken value = element[propertyName];
        return value != null && value.Type == JTokenType.String
            ? value.Value<string>()
            : null;
    }

    private string ReadNestedString(
        JToken element,
        string objectName,
        string propertyName)
    {
        JToken child = element[objectName];
        return child is JObject
                ? ReadString(child, propertyName)
                : null;
    }

    private string ReadNestedRawJson(JToken element, string propertyName)
    {
        JToken value = element[propertyName];
        return value != null && value.Type != JTokenType.Null
                ? value.ToString(Formatting.None)
                : null;
    }

    private object ReadNestedInt(
        JToken element,
        string objectName,
        string propertyName)
    {
        JToken child = element[objectName];
        JToken value = child is JObject ? child[propertyName] : null;
        return value != null &&
            value.Type == JTokenType.Integer &&
            value.ToObject<int?>().HasValue
                ? (object)value.ToObject<int>()
                : null;
    }
}
