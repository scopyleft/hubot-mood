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
        engine.store({ user: user, mood: mood }, function(err, reply) {
            if (err) return msg.send(err);
            msg.send(format('Recorded entry: %s is in a %s mood today', user, mood));
        });
    });

    robot.respond(/mood today$/i, function(msg) {
        msg.send(format("Today's moods:"));
        engine.query({ date: dateUtil.today() }, function(err, moods) {
            if (err) return msg.send(err);
            if (!moods || !moods.length) return msg.send('No mood entry for today.');
            moods.forEach(function(mood) {
                msg.send(format('- %s is in a %s mood', mood.user, mood.mood));
            });
        });
    });

    robot.respond(/mood yesterday$/i, function(msg) {
        msg.send(format("Yesterday's moods:"));
        engine.query({ date: dateUtil.yesterday() }, function(err, moods) {
            if (err) return msg.send(err);
            if (!moods || !moods.length) return msg.send('No mood entry for yesterday.');
            moods.forEach(function(mood) {
                msg.send(format('- %s was in a %s mood', mood.user, mood.mood));
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
            msg.send(format('%s: %s is in a %s mood', moods[0].date, moods[0].user, moods[0].mood));
        });
    });
};
