// Description:
//   Records moods over time.
//
// Dependencies:
//   redis
//
// Configuration:
//   HUBOT_MOOD_REDIS_URL: url to redis storage backend
//
// Commands:
//   mood set "<sunny|cloudy|rainy|stormy>"
//   mood of <(nickname)|me>
//   mood today
//   mood yesterday
//   mood week of <(nickname)|me>
//   mood month of <(nickname)|me>
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

    engine.on('info', function(msg) {
        robot.logger.info(msg);
    });

    robot.respond(/mood set (\w+)$/i, function(msg) {
        var user = msg.message.user && msg.message.user.name || "anon"
         ,  mood = msg.match[1].toLowerCase();
        engine.store({ user: user, mood: mood }, function(err, stored) {
            if (err) return msg.send(err);
            msg.send(format('Recorded entry: %s', stored));
        });
    });

    robot.respond(/mood (today|yesterday)$/i, function(msg) {
        engine.query({ date: dateUtil.today() }, function(err, moods) {
            if (err) return msg.send(err);
            if (!moods || !moods.length) {
                return msg.send(format('No mood entry for %s.', msg.match[1]));
            }
            moods.forEach(function(mood) {
                msg.send('- ' + mood.toString());
            });
        });
    });

    robot.respond(/mood month (of|for) (.*)$/i, function(msg) {
        var user = msg.match[2];
        if (user.toLowerCase().trim() === "me") {
            user = msg.message.user && msg.message.user.name;
        }
        engine.graph({ user: user, since: 30 }, function(err, graph) {
            if (err) return msg.send(err);
            msg.send(graph);
        });
    });

    robot.respond(/mood week (of|for) (.*)$/i, function(msg) {
        var user = msg.match[2];
        if (user.toLowerCase().trim() === "me") {
            user = msg.message.user && msg.message.user.name;
        }
        engine.graph({ user: user, since: 7 }, function(err, graph) {
            if (err) return msg.send(err);
            msg.send(graph);
        });
    });

    robot.respond(/mood (of|for) (.*)$/i, function(msg) {
        var user = msg.match[2];
        if (user.toLowerCase().trim() === "me") {
            user = msg.message.user && msg.message.user.name;
        }
        engine.query({date: dateUtil.today(), user: user}, function(err, moods) {
            if (err) return msg.send(err);
            if (!moods || !moods[0]) {
                return msg.send(format('%s has not set a mood, yet', user));
            }
            msg.send(moods[0].toString());
        });
    });
};
