# Twitch Commands Extension

Twitch Extension panel with searchable chat commands, category filters and
access-level filters for everyone, VIPs and moderators. It is a command
catalogue only: it does not register chat commands or execute them.

## Twitch assets

Upload these files as extension assets:

- Panel view: `panel.html`, `panel.css`, `panel.js`, `commands-data.js`
- Configuration view: `config.html`, `config.css`, `config.js`,
  `commands-data.js`

Configure the Extension's panel view to use `panel.html` and its broadcaster
configuration view to use `config.html`. The panel reads the broadcaster's
saved Extension configuration and falls back to the included N4JT command
catalogue if none has been saved.

## Configure categories and commands

In the broadcaster configuration view:

1. Add categories and commands with the forms, or edit the JSON directly.
2. Use **Load URL** to import a public JSON endpoint or paste JSON into the
   import field. The import is staged in the editor and is not saved until you
   click **Save to Twitch**.
3. Select one or more access roles: `everyone`, `vip`, or `mods`.
4. Save the configuration to the Twitch Extension configuration service.

The JSON format is:

```json
{
  "schemaVersion": 1,
  "groups": [
    {
      "id": "wheels",
      "label": "Wheels",
      "description": "Commands for wheel interactions",
      "commands": [
        {
          "id": "wheel",
          "name": "!wheel",
          "description": "Spin the active game's wheel",
          "usage": "!wheel",
          "roles": ["everyone"]
        }
      ]
    }
  ]
}
```

The importer also accepts a root array of groups, and command aliases
`command` for `name`, `body` for `description`, and `access` for `roles`.
Configuration is limited to 5 KB to match Twitch's broadcaster configuration
service limit. Roles are labels and filters for the catalogue; Twitch's
Extension panel cannot verify whether a viewer is a VIP or moderator.

## Public catalogue and JSON

The public catalogue page is `/commands`. The grouped, CORS-enabled JSON feed
is `/api/ttv-commands`; use that URL in the configuration view to load the
latest N4JT catalogue into a channel's extension config.
