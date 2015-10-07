# slack-export
export private groups in slack

## Description ##
This script exports a single private group into an export directory consisting of:
- channels.json
- users.json
- folder of messages

This export can be used to import into a different slack team using the slack import tool: http://my.slack.com/services/import

## Running ##

```
npm install
```

```
node export-group.js <group name> [credentials file]
```

Credentials file is a json containing the auth token for your user account:
```
{
  "token":"XXXXXXXXXXX"
}
```

By default the app looks for file credentials.json (supplied, but incomplete).

## Coming ##
- Export for multiple groups
- Export for DM history
- Flag for group/channel export
