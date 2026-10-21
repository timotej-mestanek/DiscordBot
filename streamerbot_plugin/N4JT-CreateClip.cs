using System;
using System.Reflection;

public class CPHInline
{
    public bool Execute()
    {
        try
        {
            object clip = CPH.CreateClip(null, 30);
            if (clip == null)
            {
                CPH.SendMessage("Klip sa nepodarilo vytvorit.");
                return false;
            }

            PropertyInfo urlProperty = clip.GetType().GetProperty("Url");
            string url = urlProperty == null
                ? ""
                : Convert.ToString(urlProperty.GetValue(clip, null));
            if (String.IsNullOrWhiteSpace(url))
            {
                CPH.LogError("N4JT !clip returned clip data without a URL.");
                CPH.SendMessage("Klip bol vytvoreny, ale jeho odkaz sa nepodarilo nacitat.");
                return false;
            }

            CPH.SendMessage("Klip: " + url);
            return true;
        }
        catch (Exception ex)
        {
            CPH.LogError("N4JT public !clip failed: " + ex.ToString());
            CPH.SendMessage("Klip sa nepodarilo vytvorit. Skus to o chvilu znova.");
            return false;
        }
    }
}
