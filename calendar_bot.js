const WickrIOAPI = require('wickrio_addon');
const WickrIOBotAPI = require('wickrio-bot-api');
const WickrUser = WickrIOBotAPI.WickrUser;
const bot = new WickrIOBotAPI.WickrIOBot();

const fs = require('fs');
var moment = require('moment');
var fuse = require('fuse.js');
const util = require('util');
const CronJob = require('cron').CronJob;
const {
  google
} = require('googleapis');
const express = require('express');
const app = express();
var validator = require('validator');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
module.exports = WickrIOAPI;
process.stdin.resume(); //so the program will not close instantly

var responseMessageList = [
  "What is the title of your event (to skip: 'skip')?",
  "What is the location of the event (to skip: 'skip')?",
  "Please give me a description of the event you want to create (to skip: 'skip')",
  "What is the date of the event? (Format: MM/DD/YYYY)",
  "What is the start time of the event? (Ex: 9:30AM or 9:30) (Note: For an all day event just write allday)",
  "What is the end time of the event? (Ex: 7PM or 19:00)",
  "Enter emails(separated by commas) of the attendees of the event (to skip: 'none')",
  "Would you like an Email or Google Popup(non-Wickr) reminder notification for this event? (Options: email, popup, both or none)",
  "How many minutes before the event would you like a reminder?"
];

var fieldDescriptions = [
  "Title",
  "Location",
  "Description",
  "Date",
  "Start Time",
  "End Time",
  "Attendees",
  "Reminder Type",
  "Reminder Time"
];

async function exitHandler(options, err) {
  try {
    var wickrUsers = bot.getUsers();
    var closed = await bot.close();
    if (err || options.exit) {
      console.log('Exit reason:', err);
      process.exit();
    } else if (options.pid) {
      process.kill(process.pid);
    }
  } catch (err) {
    console.log(err);
  }
}

//catches ctrl+c and stop.sh events
process.on('SIGINT', exitHandler.bind(null, {
  exit: true
}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {
  pid: true
}));
process.on('SIGUSR2', exitHandler.bind(null, {
  pid: true
}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {
  exit: true,
  reason: 'uncaughtException'
}));



var tokens, credentials, bot_username, bot_client_port, bot_client_server, client_id, project_id, client_secret;
var tokens = JSON.parse(process.env.tokens);

return new Promise(async (resolve, reject) => {
  try {
    var status;
    if (process.argv[2] === undefined) {
      bot_username = tokens.BOT_USERNAME.value;
      status = await bot.start(bot_username)
      resolve(status);
    } else {
      status = await bot.start(process.argv[2]);
      resolve(status);
    }

  } catch (err) {
    return console.log(err);
  }
}).then(async result => {
  if (!result) {
    exitHandler(null, {
      exit: true,
      reason: 'Client not able to start'
    });
  }
  try {
    //MAYBE change into a dynamic for loop
    if (tokens.GOOGLE_CALENDAR_CLIENT_ID.encrypted) {
      client_id = WickrIOAPI.cmdDecryptString(tokens.GOOGLE_CALENDAR_CLIENT_ID.value);
    } else {
      client_id = tokens.GOOGLE_CALENDAR_CLIENT_ID.value;
    }
    if (tokens.GOOGLE_CALENDAR_PROJECT_ID.encrypted) {
      project_id = WickrIOAPI.cmdDecryptString(tokens.GOOGLE_CALENDAR_PROJECT_ID.value);
    } else {
      project_id = tokens.GOOGLE_CALENDAR_PROJECT_ID.value;
    }
    if (tokens.GOOGLE_CALENDAR_CLIENT_SECRET.encrypted) {
      client_secret = WickrIOAPI.cmdDecryptString(tokens.GOOGLE_CALENDAR_CLIENT_SECRET.value);
    } else {
      client_secret = tokens.GOOGLE_CALENDAR_CLIENT_SECRET.value;
    }
    if (tokens.BOT_CLIENT_PORT.encrypted) {
      bot_client_port = WickrIOAPI.cmdDecryptString(tokens.BOT_CLIENT_PORT.value);
    } else {
      bot_client_port = tokens.BOT_CLIENT_PORT.value;
    }
    if (tokens.BOT_CLIENT_SERVER.encrypted) {
      bot_client_server = WickrIOAPI.cmdDecryptString(tokens.BOT_CLIENT_SERVER.value);
    } else {
      bot_client_server = tokens.BOT_CLIENT_SERVER.value;
    }
    credentials = {
      "installed": {
        "client_id": client_id,
        "project_id": project_id,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://www.googleapis.com/oauth2/v3/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": client_secret,
        "redirect_uris": ["https://" + bot_client_server + "/auth/google/callback"]
      }
    };
    await bot.startListening(listen);
    server = app.listen(bot_client_port, () => {
      console.log('Wickr IO Calendar Bot is running on port', bot_client_port);
    });

    app.get('/auth/google/callback', (req, res) => {
      // res.redirect('back');
      res.send("Thanks for using the WickrIO Google Calendar Integration!");
      var code = req.query.code; //access_token
      var user = bot.getUser(req.query.state);
      if (user.command === '/list' && user.command)
        authorize(user, user.current_vGroupID, user.argument, listEvents, code);
      else if (user.command === '/create' && user.googleCalendarEvent)
        authorize(user, user.current_vGroupID, user.googleCalendarEvent, createEvent, code);
      else
        WickrIOAPI.cmdSendRoomMessage(user.current_vGroupID, 'Your OAuth request expired, please retry by starting a /list or /create command.');
    });
  } catch (err) {
    console.log(err);
    process.exit();
  }
}).catch(error => {
  console.log(error);
});




/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(wickrUser, vGroupID, argument, callback, code) {
  const {
    client_secret,
    client_id,
    redirect_uris
  } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);
  //Handling refresh tokens
  oAuth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      //Storing the refresh_token in database
      wickrUser.token = tokens;
    }
  });
  // Check if we have previously stored a token.
  if (code) {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        WickrIOAPI.cmdSendRoomMessage(vGroupID, 'Error retrieving access token, please try again or contact your network administrator.');
        return console.error('Error retrieving access token, please try again or contact your network administrator.', err);
      }
      //Store the token to disk for later program executions
      oAuth2Client.setCredentials(token);
      wickrUser.token = token;
      getPrimaryCalInfo(oAuth2Client, wickrUser, function() {
        if (argument.start) {
          argument.start.timeZone = wickrUser.timeZone;
          argument.end.timeZone = wickrUser.timeZone;
        }
        callback(oAuth2Client, vGroupID, wickrUser, argument);
      });
    });
  } else if (Object.keys(wickrUser.token).length) {
    oAuth2Client.setCredentials({
      refresh_token: wickrUser.token.refresh_token
    });
    callback(oAuth2Client, vGroupID, wickrUser, argument);
  } else {
    wickrUser.current_vGroupID = vGroupID;
    return getAccessToken(oAuth2Client, vGroupID, wickrUser, argument, callback);
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getAccessToken(oAuth2Client, vGroupID, wickrUser, argument, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: wickrUser.userEmail
  });
  WickrIOAPI.cmdSendRoomMessage(vGroupID, 'Authorize this app by visiting this url: ' + authUrl);
}

function getPrimaryCalInfo(auth, wickrUser, callback) {
  try {
    const calendar = google.calendar({
      version: 'v3',
      auth
    });
    calendar.calendars.get({
      auth: auth,
      calendarId: 'primary'
    }, function(err, response) {
      if (err) {
        try {
          WickrIOAPI.cmdSendRoomMessage(wickrUser.vGroupID, 'There was an error contacting the Calendar service: ' + err);
          console.log('There was an error contacting the Calendar service: ' + err);
          return;
        } catch (err) {
          return console.log(err);
        }
      }
      var timeZone = response.data.timeZone;
      var user = bot.getUser(wickrUser.userEmail);
      user.timeZone = timeZone;
      callback();
    });
  } catch (err) {
    console.log(err);
  }
}


/**
 * Lists upcoming events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth, vGroupID, wickrUser, argument) {
  try {
    const calendar = google.calendar({
      version: 'v3',
      auth
    });
    if (isNaN(argument) || !argument) {
      argument = 5;
    }
    var user = bot.getUser(wickrUser.userEmail);
    user.events = [];
    calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: argument,
      singleEvents: true,
      orderBy: 'startTime',
    }, (err, res) => {
      if (err) {
        WickrIOAPI.cmdSendRoomMessage(vGroupID, "Sorry, I was not able create this Google Calendar event: " + err + "\nPlease try again or contact your network administrator.");
        console.log('There was an error contacting the Calendar service: ' + err);
        if (err.Error === 'invalid_grant')
          user.token = '';
        return;
      }
      const events = res.data.items;
      if (events.length) {
        var eventsMsg = [];
        eventsMsg.push(argument + ' upcoming ' + ' events:')
        events.map((event, i) => {
          i += 1;
          var title, start, startTime, startDate;
          if (event.start.hasOwnProperty('dateTime')) {
            start = event.start.dateTime.split('T');
            startTime = start[1].substr(0, start[1].length - 9);
            startTime = moment(startTime, 'HH:mm:ss').format('h:mm A');
            startDate = moment(start[0], 'YYYY-MM-DD').format('M/D/YYYY');
          } else if (event.start.hasOwnProperty('date')) {
            startDate = moment(event.start.date, 'YYYY-MM-DD').format('M/D/YYYY');
            startTime = 'All day';
          }

          var options = {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          };
          /////////////////////////////////////
          //For modify, get and reminder actions
          user.events.push({
            number: i,
            id: event.id
          });
          if (!event.summary) {
            title = "No title";
          } else {
            title = event.summary;
          }
          //////////////////////////////////////
          eventsMsg.push(`${i}: ${title} - ${startDate} at ${startTime}`);
        });
        // eventsMsg.push('To get detailed information about a specific event, type /get EVENT_NUMBER');
        WickrIOAPI.cmdSendRoomMessage(vGroupID, eventsMsg.join('\n'));
      } else {
        WickrIOAPI.cmdSendRoomMessage(vGroupID, 'No upcoming events found.');
      }
    });
  } catch (err) {
    console.log(err);
  }
}


function createEvent(auth, vGroupID, wickrUser, event) {
  const calendar = google.calendar({
    version: 'v3',
    auth
  });
  calendar.events.insert({
    auth: auth,
    calendarId: 'primary',
    sendUpdates: 'all',
    resource: event,
  }, function(err, response) {
    if (err) {
      WickrIOAPI.cmdSendRoomMessage(vGroupID, "Sorry, I was not able create this Google Calendar event, please try again or contact your network administrator.");
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    var link = response.data.htmlLink;
    WickrIOAPI.cmdSendRoomMessage(vGroupID, 'Event created: ' + link);
    var user = bot.getUser(wickrUser.userEmail);
    user.index = 12;
    WickrIOAPI.cmdSendRoomMessage(vGroupID, 'By the way, would you also like to set up Wickr in-app notifications for this event?');
  });
}


function modifyEvent(auth, vGroupID, wickrUser, event) {
  const calendar = google.calendar({
    version: 'v3',
    auth
  });
  var eventId;
  var eventLocalId = event.eventId;
  delete event.eventId;
  for (var i in wickrUser.events) {
    if (parseInt(eventLocalId) === wickrUser.events[i].number) {
      eventId = wickrUser.events[i].id;
    }
  }
  calendar.events.update({
    auth: auth,
    calendarId: 'primary',
    eventId: eventId,
    sendUpdates: 'all',
    resource: event,
  }, function(err, response) {
    if (err) {
      //  var response = ", please try again later or contact your network administrator.";
      WickrIOAPI.cmdSendRoomMessage(vGroupID, 'Sorry, I was not able modify this Google Calendar event: ' + err);
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    var link = response.data.htmlLink;
    WickrIOAPI.cmdSendRoomMessage(vGroupID, 'Event updated: ' + link);
  });
}


function setReminders(wickrUser, vGroupID, reminderType) {
  var timeBefore = wickrUser.wickrReminderTime.split(' ');
  if (!wickrUser.googleCalendarEvent.start.date) {
    var startTime = moment.tz(wickrUser.startTimeDate, wickrUser.timeZone);
  } else {
    var startTime = moment.tz(wickrUser.startDate, wickrUser.timeZone);
  }
  // ADD interpreting various versions of the words: days, hours and minutes
  // var hour = ['h', 'hr', 'hour', 'hours'];
  // wickrUser.startTimeDate.toNow()
  startTime.subtract(parseInt(timeBefore[0]), timeBefore[1]);
  var date = new Date(startTime);
  if (wickrUser.wickrReminderType === ('personal')) {
    var event = wickrUser.event;
    event.wickrReminderTime = wickrUser.wickrReminderTime;
    try {
      const job = new CronJob(date, function() {
        WickrIOAPI.cmdSendRoomMessage(wickrUser.vGroupID, 'Google Calendar event titled: ' + event.title + ' starts in ' + event.wickrReminderTime);
      }.bind(null, event), null, true, wickrUser.timeZone);
      console.log('CronJob:', job)
    } catch (err) {
      WickrIOAPI.cmdSendRoomMessage(vGroupID, "Cannot set reminder: " + err.error + "\nPlease try again.");
      return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "How long before the event would you like the reminder(in days, hours or minutes)? (example: 1 hour)"));
      console.log("CronJob err:", err)
    }
    WickrIOAPI.cmdSendRoomMessage(vGroupID, "Okay, reminder set for " + wickrUser.wickrReminderTime + " before the event");
  } else if (wickrUser.wickrReminderType === ('room') || wickrUser.wickrReminderType === ('both')) {
    var roomChoice = wickrUser.wickrReminderRoomNumber;
    var vGroupID;
    for (var i in wickrUser.rooms) {
      if (parseInt(roomChoice) === wickrUser.rooms[i].number) {
        vGroupID = wickrUser.rooms[i].vGroupID;
      }
    }
    var event = wickrUser.event;
    event.wickrReminderTime = wickrUser.wickrReminderTime;
    if (wickrUser.wickrReminderType.toLowerCase() === 'room') {
      try {
        const job = new CronJob(date, function() {
          WickrIOAPI.cmdSendRoomMessage(vGroupID, 'Google Calendar event titled: ' + event.title + ' starts in ' + event.wickrReminderTime);
        }.bind(null, event), null, true, wickrUser.timeZone);
        console.log('CronJob:', job)
      } catch (err) {
        WickrIOAPI.cmdSendRoomMessage(vGroupID, "Cannot set reminder: " + err.error + "\nPlease try again.");
        return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "How long before the event would you like the reminder(in days, hours or minutes)? (example: 1 hour)"));
        console.log("CronJob err:", err)
      }
    } else {
      try {
        const job = new CronJob(date, function() {
          WickrIOAPI.cmdSendRoomMessage(vGroupID, 'Google Calendar event titled: ' + event.title + ' starts in ' + event.wickrReminderTime);
          WickrIOAPI.cmdSendRoomMessage(wickrUser.vGroupID, 'Google Calendar event titled: ' + event.title + ' starts in ' + event.wickrReminderTime);
        }.bind(null, event), null, true, wickrUser.timeZone);
        console.log('CronJob:', job)
      } catch (err) {
        WickrIOAPI.cmdSendRoomMessage(vGroupID, "Cannot set reminder: " + err + "\nPlease try again.");
        return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "How long before the event would you like the reminder(in days, hours or minutes)? (example: 1 hour)"));
        console.log("CronJob err:", err)
      }
    }
    // require('crontab').load(function(err, crontab) {
    //   var jobs = crontab.jobs();
    //   console.log('scheduled cron jobs:', jobs)
    // });
    WickrIOAPI.cmdSendRoomMessage(vGroupID, "Okay, reminder set for " + wickrUser.wickrReminderTime + " before the event");
  }
}

function listen(rMessage) {
  try {
    var parsedMessage = bot.parseMessage(rMessage);
    if (!parsedMessage) {
      return;
    }
    var command = parsedMessage.command;
    var message = parsedMessage.message;
    var argument = parsedMessage.argument;
    var userEmail = parsedMessage.userEmail;
    var vGroupID = parsedMessage.vgroupid;
    if ((command === '/help') || (message === 'help')) {
      var help = "/help - List all available commands\n" +
        "/list - List 5 most recent upcoming Google Calendar events\n" +
        "/list AMOUNT - List AMOUNT upcoming Google Calendar events\n" +
        "/create - Create a Google Calendar event\n" +
        "/modify EVENT_ID - Modify the specified Google Calendar event(run '/list' first to get the list of events and their IDs)";
      return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, help));
    }
    var user = bot.getUser(userEmail);
    if (user === undefined) {
      var wickrUser = new WickrUser(userEmail, {
        index: 0,
        personal_vGroupID: "",
        command: "",
        argument: "",
        token: {},
        event: {},
        events: [],
        rooms: []
      });
      bot.addUser(wickrUser);
    }
    user = bot.getUser(userEmail);
    var current = user.index;
    user.current_vGroupID = vGroupID;
    if (command === '/list') {
      user.command = command;
      user.argument = argument;
      authorize(user, vGroupID, argument, listEvents);
    } else if (command === '/create') {
      user.command = command;
      user.argument = argument;
      user.event = {};
      user.index = 1;
      return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, responseMessageList[0]));
    } else if (command === '/modify') {
      user.command = command;
      user.argument = argument;
      if (!user || isNaN(argument)) {
        return WickrIOAPI.cmdSendRoomMessage(vGroupID, "Please run the /list command first and send the /modify command again with an event number from the list (ex: /modify 3)");
      }
      user.event = {};
      user.index = 1;
      return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, responseMessageList[0]));
    } else {
      /////////////////////////////////
      //start question flow
      /////////////////////////////////
      user = bot.getUser(userEmail);
      var current = user.index;
      if (current < 16 && current > 0) {
        if (current === 1) {
          if (message !== "skip")
            user.event.title = message;
          else {
            user.event.title = 'none';
          }
        } else if (current === 2) {
          if (message !== "skip")
            user.event.location = message;
          else {
            user.event.location = 'none';
          }
        } else if (current === 3) {
          if (message !== "skip")
            user.event.description = message;
          else {
            user.event.description = 'none';
          }
        } else if (current === 4) {
          if (!moment(message, 'MM-DD-YYYY').isValid()) {
            return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "Invalid date entry, please use the following format MM/DD/YYYY"));
          }
          user.event.startDate = message;
        } else if (current === 5) {
          var choice = message;
          var options = ["allday", "all day"];
          var response = options.some(el => choice.includes(el));
          if (response) {
            user.index = current + 1;
            user.event.startTime = "Allday";
            user.event.endTime = "Allday";
          } else {
            if (!moment(message, 'h:mm A').isValid() || !moment(message, 'HH:mm:ss').isValid()) {
              return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "Invalid start time entry, please use a 12-hour or 24-hour format(ex: 5AM or 05:00)"));
            }
            user.event.startTime = message;
          }
        } else if (current === 6) {
          if (!moment(message, 'h:mm A').isValid() || !moment(message, 'HH:mm:ss').isValid()) {
            return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "Invalid end time entry, please use a 12-hour or 24-hour format(ex: 7:45PM or 19:45)"));
          }
          user.event.endTime = message;
        } else if (current === 7) {
          if (message !== "none") {
            var attendees = [];
            var emails = message.split(',');
            for (var i in emails) {
              if (!validator.isEmail(emails[i].replace(/\s/g, ''))) {
                return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, emails[i].replace(/\s/g, '') + " is an invalid email address, please try again"));
              } else {
                attendees.push({
                  'email': emails[i].replace(/\s/g, '')
                });
              }
            }
            user.event.attendees = attendees;
          } else {
            user.event.attendees = message;
          }
        } else if (current === 8) {
          var choice = message;
          var options = ["email", "popup", "both", "none"];
          var response = options.some(el => choice.includes(el));
          if (!response) {
            return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "Invalid choice, please enter one of the following: email, popup, both or none"));
          }
          if (choice === "none") {
            user.index = current + 2;
            user.event.reminderChoice = choice;
            return listen(rMessage);
          } else {
            user.event.reminderChoice = choice;
          }
        } else if (current === 9) {
          var time = message;
          user.event.reminderTime = time;
          var reminderChoice = user.event.reminderChoice;
          var reminders = [];
          if (reminderChoice === 'email') {
            reminders.push({
              'method': 'email',
              'minutes': time
            });
          } else if (reminderChoice === 'popup') {
            reminders.push({
              'method': 'popup',
              'minutes': time
            });
          } else if (reminderChoice === 'both') {
            reminders.push({
              'method': 'email',
              'minutes': time
            });
            reminders.push({
              'method': 'popup',
              'minutes': time
            });
          }
          user.event.reminders = reminders;
          user.index = current + 1;
          return listen(rMessage);
        } else if (current === 10) {
          user.index = current + 1;
          var event = user.event;
          var confirmationMessage = ["Please confirm the information you entered:"];
          var answer;
          ////////////////////////
          Object.keys(event).forEach(function(key, index) {
            var choice = event[key];
            if (index > 3 && !event.startTime) {
              index += 2;
            }
            if (choice === undefined) {
              choice = "none";
            }
            if (fieldDescriptions[index] === undefined)
              return;
            else if (fieldDescriptions[index] === "Reminder Time") {
              answer = fieldDescriptions[index] + ': ' + choice + ' minutes';
            } else if (fieldDescriptions[index] === 'Attendees' && choice !== 'none') {
              var emails = [];
              for (var i in choice) {
                emails.push(choice[i].email);
              }
              choice = emails.join('\n\t');
              answer = fieldDescriptions[index] + ':\n\t' + choice;
            } else {
              answer = fieldDescriptions[index] + ': ' + choice;

            }
            confirmationMessage.push(answer);
          });
          answer = "Is this accurate? (yes/no)";
          confirmationMessage.push(answer);
          confirmationMessage = confirmationMessage.join('\n');
          return WickrIOAPI.cmdSendRoomMessage(vGroupID, confirmationMessage);
        } else if (current === 11) {
          user.index = 0;
          if (message === 'yes' || message === 'y') {
            var event = user.event;
            var timeZone = user.timeZone;
            var googleCalendarEvent = {};

            if (event.title !== 'none') {
              googleCalendarEvent.summary = event.title;
            }

            if (event.location !== 'none') {
              googleCalendarEvent.location = event.location;
            }

            if (event.description !== 'none') {
              googleCalendarEvent.description = event.description;
            }

            if (!event.startTime || event.startTime === 'Allday') {
              var startDate = moment(event.startDate, "MM-DD-YYYY").format("YYYY-MM-DD");
              user.startDate = startDate;
              googleCalendarEvent.start = {
                'date': startDate,
                'timeZone': timeZone
              };
              googleCalendarEvent.end = {
                'date': startDate,
                'timeZone': timeZone
              };
            } else {
              var startTime, endTime;
              if (moment(event.startTime, 'HH:mm:ss', true).isValid()) {
                startTime = moment(event.startTime, 'HH:mm:ss');
              } else {
                startTime = moment(event.startTime, 'h:mm A').format('HH:mm:ss');
              }
              if (moment(event.endTime, 'HH:mm:ss', true).isValid()) {
                endTime = moment(event.endTime, 'HH:mm:ss');
              } else {
                endTime = moment(event.endTime, 'h:mm A').format('HH:mm:ss');
              }
              var startTimeDate = moment(event.startDate + '' + startTime, "MM-DD-YYYYTHH:mm:ss").format("YYYY-MM-DDTHH:mm:ss");
              user.startTimeDate = startTimeDate;
              var endTimeDate = moment(event.startDate + '' + endTime, "MM-DD-YYYYTHH:mm:ss").format("YYYY-MM-DDTHH:mm:ss");
              user.endTimeDate = endTimeDate;

              googleCalendarEvent.start = {
                'dateTime': startTimeDate,
                'timeZone': timeZone
              };
              googleCalendarEvent.end = {
                'dateTime': endTimeDate,
                'timeZone': timeZone
              };
            }

            if (event.attendees !== 'none') {
              googleCalendarEvent.attendees = event.attendees;
            }

            if (event.reminderChoice !== 'none') {
              googleCalendarEvent.reminders = {
                'useDefault': false,
                'overrides': event.reminders
              };
            }
            user.googleCalendarEvent = googleCalendarEvent;
            if (user.command === "/create") {
              var positiveResponse = "Great, please hold on while I create your Google Calendar event..."
              WickrIOAPI.cmdSendRoomMessage(vGroupID, positiveResponse);
              return authorize(user, vGroupID, googleCalendarEvent, createEvent);
            } else if (user.command === "/modify") {
              googleCalendarEvent.eventId = user.argument;
              var positiveResponse = "Great, please hold on while I update your Google Calendar event..."
              WickrIOAPI.cmdSendRoomMessage(vGroupID, positiveResponse);
              return authorize(user, vGroupID, googleCalendarEvent, modifyEvent);
            }
          } else {
            var negativeResponse = "Okay, ticket creation cancelled. you can restart this process by entering the /create command or /help for the list of all commands?";
            return WickrIOAPI.cmdSendRoomMessage(vGroupID, negativeResponse);
          }
        } else if (current === 12) {
          if (message === ('yes' || 'y')) {
            user.index += 1;
            return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "What type of reminder would you like: personal, room or both?"));
          } else {
            user.index = 0;
            return;
          }
        } else if (current === 13) {
          user.index += 1;
          user.wickrReminderType = message;
          if (message === 'room' || message === 'both') {
            var rooms = WickrIOAPI.cmdGetRooms();
            rooms = JSON.parse(rooms);
            var roomTitles = [];
            var roomsMessage = ["Please choose a room number from the following list\n(FYI: Only rooms i'm apart of will show up on the list, if you don't see the desired room on the list, please add me to that room and run the /modify command on this event):\n"];
            rooms.rooms.map((room, i) => {
              i += 1;
              user.rooms.push({
                number: i,
                vGroupID: room.vgroupid
              });
              var line = i + ': ' + room.title;
              roomTitles.push(line);
            });
            roomsMessage.push(roomTitles.join('\n'));
            roomsMessage = roomsMessage.join('\n');
            return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, roomsMessage));
          } else {
            user.index += 1;
            return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "How long before the event would you like the reminder(in days, hours or minutes)? (example: 1 hour)"));
          }
        } else if (current === 14) {
          user.wickrReminderRoomNumber = message;
          user.index += 1;
          return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "How long before the event would you like the reminder(in days, hours or minutes)? (example: 1 hour)"));
        } else if (current === 15) {
          user.wickrReminderTime = message;
          return setReminders(user, vGroupID);
        }
        current = user.index;
        if (current <= responseMessageList.length && current !== -1) {
          try {
            user.index = current + 1;
            return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, responseMessageList[current]));
          } catch (err) {
            return console.log(err);
          }
        }
      } else if (current === 16) {
        user.index = 0;
        var newMessage = JSON.parse(rMessage);
        if (message === "yes") {
          newMessage.message = user.command;
        } else {
          newMessage.message = "/help";
        }
        newMessage = JSON.stringify(newMessage);
        return listen(newMessage);
      } else {
        var commands = ["/help", "/list", "/create", "/modify"];
        var options = {
          shouldSort: true,
          includeScore: true,
          threshold: 0.6,
          location: 0,
          distance: 100,
          maxPatternLength: 32,
          minMatchCharLength: 3,
          keys: undefined
        };
        var fuzzy = new fuse(commands, options);
        var result = fuzzy.search(message);
        console.log('result of fuzzy search:', result);
        user.index = 16;
        if (result.length > 0) {
          user.command = commands[result[0].item];
          return console.log(WickrIOAPI.cmdSendRoomMessage(vGroupID, "Did you mean to send the " + commands[result[0].item] + " command?"));
        }
      }
    }
  } catch (err) {
    console.log(err);
  }
}
