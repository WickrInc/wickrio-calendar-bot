# WickrIO Google Calendar Bot

The WickrIO Google Calendar Bot allows you to create, modify and list Google Calendar events in addition to setting in-Wickr reminder notifications before events.

## Commands:

- /help - List all available commands
- /list - List 5 most recent upcoming Google Calendar events
- /list AMOUNT - List AMOUNT upcoming Google Calendar events
- /create - Create a Google Calendar event
- /modify EVENT_ID - Modify the specified Google Calendar event(run '/list' first to get the list of events and their IDs)


## Configuration:

1. First create a Google Calendar API project at [https://console.developers.google.com/] (https://console.developers.google.com/)
2. After creating the project, Click 'Enable APIS and Services' and search for Google Calendar API and click 'Enable'
3. On the left Menu Bar select "Credentials" -> "Create Credential"
4. Choose "OAuth Client ID", then under "Application type" choose "Web Application"
5. Enter your bot_client_server in the "Authorized JavaScript origins" and "Authorized redirect URIs" fields and click "Create"
6. Finally download and save your OAuth Client credentials, which will contain the following tokens that will you will be prompted for during configuration:

- GOOGLE_CALENDAR_CLIENT_ID
- GOOGLE_CALENDAR_PROJECT_ID
- GOOGLE_CALENDAR_CLIENT_SECRET

* Other environment variables you will have to enter during the configuration process:
- DATABASE_ENCRYPTION_KEY(16 characters minimum) - the string key to derive the crypto key from in order to encrypt and decrypt the user database of this bot. This must be specified, there is no default. NOTE: be careful not to change if reconfiguring the bot or else the user database won't be accessible.
- BOT_CLIENT_SERVER - The server address of the machine you are running your integration on(without the https://)
- BOT_CLIENT_SERVER - The port you assigned to the docker container when you ran it, for example if you ran it with this command: `docker run -v /opt/WickrIO:/opt/WickrIO -p 5001:4001 -d --restart=always -ti wickr/bot-cloud:latest`, then the port would be 4001.
