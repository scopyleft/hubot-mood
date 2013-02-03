/*global module*/
var events = require('events')
 ,  util = require('util')
 ,  format = util.format
 ,  dateUtil = require('./date-util');

const BARS        = "▇▅▃▁".split('')
    , SYMBOLS     = "☀☁☂⚡".split('')
    , VALID_MOODS = "sunny|cloudy|rainy|stormy".split('|');

function MoodEngine(client, options) {
    events.EventEmitter.call(this);
    this.client   = client;
    this.redisKey = options && options.redisKey || "moods";
}
util.inherits(MoodEngine, events.EventEmitter);
module.exports = MoodEngine;

MoodEngine.prototype.clear = function clear() {
    this.emit('debug', format('clearing records in %s', this.redisKey));
    this.client.del(this.redisKey);
    this.emit('debug', format('deleted records in %s', this.redisKey));
};

MoodEngine.prototype.filter = function filter(moods, filters) {
    if (!moods.length || !filters) {
        return [];
    }
    return moods.filter(function(mood) {
        var included = true;
        if (filters.date) {
            included = included && mood.date === filters.date;
        }
        if (~~filters.since > 0) {
            included = included && mood.date >= dateUtil.daysBefore(~~filters.since - 1);
        }
        if (filters.user) {
            included = included && mood.user === filters.user;
        }
        return included;
    });
};

MoodEngine.prototype.query = function query() {
    var filters = {}, cb;
    if (arguments.length === 2 && typeof arguments[1] === "function") {
        filters = typeof arguments[0] === "object" ? arguments[0] : {};
        cb = arguments[1];
    } else {
        cb = arguments[0];
    }
    this.client.lrange(this.redisKey, 0, -1, function(err, reply) {
        var moods = [];
        if (err) return cb.call(this, err);
        try {
            moods = reply.map(function(entry) {
                return Mood.parse(entry);
            });
        } catch (e) {
            err = e;
        }
        return cb.call(this, err, this.filter(moods, filters));
    }.bind(this));
};

MoodEngine.prototype.exists = function exists(filters, cb) {
    this.query(filters, function(err, moods) {
        if (err) return cb.call(this, err);
        return cb.call(this, err, moods.length > 0);
    });
};

MoodEngine.prototype.graph = function graph(filters, cb) {
    if (!filters.user) return cb.call(this, new Error("a user is mandatory"));
    if (!filters.since) return cb.call(this, new Error("a since filter is mandatory"));
    this.query(filters, function(err, moods) {
        var graph = "";
        if (!moods || !moods.length) {
            return cb.call(this, new Error(format('No mood entry for %s in the last %d days.',
                                                  filters.user, filters.since)));
        }
        return cb.call(this, null, moods.sort(function(a, b) {
            return a.date > b.date;
        }).map(function(mood) {
            return mood.bar();
        }).join(''));
    });
};

MoodEngine.prototype.store = function store(data, cb) {
    var mood;
    try {
        mood = new Mood(data);
    } catch (err) {
        return cb.call(this, err);
    }
    this.exists({ date: data.date, user: data.user }, function(err, exists) {
        if (err) return cb.call(this, err);
        if (exists) {
            return cb.call(this, new Error(format('Mood already stored for %s on %s',
                                                  data.user, data.date)));
        }
        this.emit('info', format('storing mood entry for %s: %s', data.user, mood.serialize()));
        this.client.rpush(this.redisKey, mood.serialize(), function(err) {
            cb.call(this, err, mood);
        }.bind(this));
    }.bind(this));
};

function Mood(data) {
    this.clean(data);
}

Mood.prototype.bar = function bar() {
    return BARS[VALID_MOODS.indexOf(this.mood)];
};

Mood.prototype.clean = function clean(data) {
    if (typeof data !== "object") {
        throw new Error("mood data must be an object");
    }
    if (!data.date) {
        data.date = dateUtil.today();
    }
    this.date = data.date;
    if (!data.user) {
        throw new Error('A user is required');
    }
    this.user = data.user;
    if (VALID_MOODS.indexOf(data.mood) === -1) {
        throw new Error(format('Invalid mood %s; valid values are %s',
                               data.mood, VALID_MOODS.join(', ')));
    }
    this.mood = data.mood;
};

Mood.prototype.serialize = function serialize() {
    return format('%s:%s:%s', dateUtil.datetime(this.date), this.user, this.mood);
};

Mood.prototype.symbol = function bar() {
    return SYMBOLS[VALID_MOODS.indexOf(this.mood)];
};

Mood.prototype.toString = function toString() {
    function formatDate(date) {
        if (date === dateUtil.today()) {
            return "Today";
        } else if (date === dateUtil.yesterday()) {
            return "Yesterday";
        } else {
            return "On " + date;
        }
    }
    var formattedDate = formatDate(this.date);
    return format("%s, %s %s on a %s mood %s",
                  formattedDate,
                  this.user,
                  formattedDate === "Today" ? "is" : "was",
                  this.mood,
                  this.symbol());
};

Mood.parse = function parse(string) {
    var parts = string.split(':');
    return new Mood({
        date: parts[0]
      , user: parts[1]
      , mood: parts[2]
    });
};

MoodEngine.Mood = Mood;
