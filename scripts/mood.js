// Description:
//   Records a team's mood over time and provides some metrics about it.
//
// Dependencies:
//   redis
//
// Configuration:
//   HUBOT_MOOD_REDIS_URL: url to redis storage backend
//
// Commands:
//   hubot mood set <sunny|cloudy|rainy|stormy> (info) - set your current mood for today
//   hubot mood of <(nickname)|me> - show your current mood if it's been set already
//   hubot mood today - show team's mood for today
//   hubot mood yesterday - show team's mood for yesterday
//   hubot mood week of <(nickname)|me> - show someone's mood bargraph for the last 7 days
//   hubot mood month of <(nickname)|me> - show someone's mood bargraph for the last 30 days
//
// Author:
//   n1k0

/*global module process*/
var MoodEngine = require('../lib')
  , dateUtil   = require('../lib/date-util')
  , util       = require('util')
  , Url        = require('url')
  , Redis      = require('redis')
  , format     = util.format;

function nickname(msg, match) {
    if (!match || match.toLowerCase().trim() === "me") {
        return msg.message.user && msg.message.user.name || "unknown";
    }
    return match;
}

module.exports = function(robot) {
    var info   = Url.parse(process.env.HUBOT_MOOD_REDIS_URL || 'redis://localhost:6379')
      , client = Redis.createClient(info.port, info.hostname)
      , engine = new MoodEngine(client);

    if (info.auth) {
        client.auth(info.auth.split(":")[1]);
    }

    client.on("error", function(err) {
        robot.logger.error(err);
    });

    client.on("connect", function() {
        robot.logger.debug("Successfully connected to Redis from mood script");
    });

    engine.on("info", function(msg) {
        robot.logger.info(msg);
    });

    robot.respond(/mood set (\w+)\s?(.*)$/i, function(msg) {
        var user = nickname(msg)
          , mood = msg.match[1].toLowerCase()
          , info = msg.match[2];
        engine.store({ user: user, mood: mood, info: info }, function(err, stored) {
            if (err) return msg.send(err);
            msg.send(format('Recorded entry: %s', stored));
        });
    });

    robot.respond(/mood (today|yesterday)$/i, function(msg) {
        var day = msg.match[1].toLowerCase()
          , date = day === "today" ? dateUtil.today() : dateUtil.yesterday();
        engine.query({ date: date }, function(err, moods) {
            if (err) return msg.send(err);
            if (!moods || !moods.length) {
                return msg.send(format('No mood entry for %s %s.', msg.match[1], day));
            }
            moods.forEach(function(mood) {
                msg.send('- ' + mood.toString());
            });
        });
    });

    robot.respond(/mood (month|week) (of|for) (.*)$/i, function(msg) {
        var user = nickname(msg, msg.match[3])
          , since = msg.match[1].toLowerCase() === "month" ? 30 : 7;
        engine.graph({ user: user, since: since }, function(err, graph) {
            if (err) return msg.send(err);
            msg.send(graph);
        });
    });

    robot.respond(/mood (of|for) (.*)$/i, function(msg) {
        var user = nickname(msg, msg.match[2])
          , date = dateUtil.today();
        engine.query({date: date, user: user}, function(err, moods) {
            if (err) return msg.send(err);
            if (!moods || !moods[0]) {
                return msg.send(format('%s has not set a mood today, yet', user));
            }
            msg.send(moods[0].toString());
        });
    });
};
