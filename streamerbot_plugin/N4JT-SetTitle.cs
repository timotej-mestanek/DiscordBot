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

        string title = FirstArg("rawInput", "input", "message");
        if (title.StartsWith("!title ", StringComparison.OrdinalIgnoreCase))
            title = title.Substring(7).Trim();
        if (String.IsNullOrWhiteSpace(title) || title.Length > 140)
        {
            CPH.SendMessage("Pouzitie: !title <novy nazov streamu> (max. 140 znakov)");
            return false;
        }

        try
        {
            if (!CPH.SetChannelTitle(title))
            {
                CPH.SendMessage("Nazov streamu sa nepodarilo zmenit.");
                return false;
            }
            CPH.SendMessage("Nazov streamu bol zmeneny.");
            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError("N4JT moderator !title failed: " + ex.ToString());
            CPH.SendMessage("Nazov streamu sa nepodarilo zmenit. Pozri Streamer.bot log.");
            return false;
        }
    }
}
