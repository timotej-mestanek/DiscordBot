using System;

public class CPHInline
{
    private string Arg(string name)
    {
        object value;
        return args.TryGetValue(name, out value) && value != null ? value.ToString() : "";
    }

    private string FirstArg(params string[] names)
    {
        foreach (string name in names)
        {
            string value = Arg(name);
            if (!String.IsNullOrWhiteSpace(value)) return value.Trim();
        }
        return "";
    }

    private bool IsTrue(string name)
    {
        bool value;
        return Boolean.TryParse(Arg(name), out value) && value;
    }

    public bool Execute()
    {
        if (!IsTrue("isModerator") && !IsTrue("isBroadcaster"))
        {
            CPH.SendMessage("Tento prikaz moze pouzit iba moderator alebo streamer.");
            return false;
        }

        string description = FirstArg("rawInput", "input", "message");
        if (description.StartsWith("!marker ", StringComparison.OrdinalIgnoreCase))
            description = description.Substring(8).Trim();
        if (description.Length > 140)
        {
            CPH.SendMessage("Popis markeru moze mat najviac 140 znakov.");
            return false;
        }

        try
        {
            object marker = CPH.CreateStreamMarker(
                String.IsNullOrWhiteSpace(description) ? null : description
            );
            if (marker == null)
            {
                CPH.SendMessage("Marker sa nepodarilo vytvorit.");
                return false;
            }
            CPH.SendMessage("Marker streamu bol vytvoreny.");
            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError("N4JT moderator !marker failed: " + ex.ToString());
            CPH.SendMessage("Marker sa nepodarilo vytvorit. Pozri Streamer.bot log.");
            return false;
        }
    }
}
