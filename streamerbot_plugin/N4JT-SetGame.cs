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

        string game = FirstArg("rawInput", "input", "message");
        if (game.StartsWith("!game ", StringComparison.OrdinalIgnoreCase))
            game = game.Substring(6).Trim();
        else if (game.StartsWith("!category ", StringComparison.OrdinalIgnoreCase))
            game = game.Substring(10).Trim();
        if (String.IsNullOrWhiteSpace(game) || game.Length > 100)
        {
            CPH.SendMessage("Pouzitie: !game <nazov hry alebo kategorie>");
            return false;
        }

        try
        {
            object result = CPH.SetChannelGame(game);
            if (result == null)
            {
                CPH.SendMessage("Hru alebo kategoriu sa nepodarilo zmenit. Skontroluj jej nazov.");
                return false;
            }
            CPH.SendMessage("Hra/kategoria streamu bola zmenena.");
            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError("N4JT moderator !game failed: " + ex.ToString());
            CPH.SendMessage("Hru sa nepodarilo zmenit. Pozri Streamer.bot log.");
            return false;
        }
    }
}
