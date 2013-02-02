/*global module*/
var events = require('events')
 ,  util = require('util')
 ,  format = util.format
 ,  dateUtil = require('./date-util');

function MoodEngine(client, options) {
    events.EventEmitter.call(this);
    this.client     = client;
    this.validMoods = "sunny|cloudy|rainy|stormy".split('|');
    this.bars       = "▇▅▃▁".split('');
    this.redisKey   = options && options.redisKey || "moods";
}
util.inherits(MoodEngine, events.EventEmitter);
module.exports = MoodEngine;

MoodEngine.prototype.clear = function clear() {
    var self = this;
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
            included = included && dateUtil.datetime(mood.date) === dateUtil.datetime(filters.date);
        }
        if (~~filters.since > 0) {
            var startDate = dateUtil.datetime(dateUtil.daysBefore(~~filters.since - 1));
            included = included && dateUtil.datetime(mood.date) >= startDate;
        }
        if (filters.user) {
            included = included && mood.user === filters.user;
        }
        return included;
    });
};

MoodEngine.prototype.query = function query() {
    var self = this, filters = {}, cb;
    if (arguments.length === 2 && typeof arguments[1] === "function") {
        filters = typeof arguments[0] === "object" ? arguments[0] : {};
        cb = arguments[1];
    } else {
        cb = arguments[0];
    }
    this.client.lrange(this.redisKey, 0, -1, function(err, reply) {
        var moods = [];
        if (err) return cb.call(self, err);
        try {
            moods = reply.map(function(entry) {
                var parts = entry.split(':');
                return {
                    date: parts[0]
                  , user: parts[1]
                  , mood: parts[2]
                };
            });
        } catch (e) {
            err = e;
        }
        return cb.call(self, err, self.filter(moods, filters));
    });
};

MoodEngine.prototype.exists = function exists(filters, cb) {
    this.query(filters, function(err, moods) {
        if (err) return cb.call(this, err);
        return cb.call(this, err, moods.length > 0);
    });
};

MoodEngine.prototype.graph = function graph(filters, cb) {
    var self = this;
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
            return self.bars[self.validMoods.indexOf(mood.mood)];
        }).join(''));
    });
};

MoodEngine.prototype.store = function store(data, cb) {
    var self = this, entry;
    if (!data.datetime) {
        data.datetime = dateUtil.datetime();
    }
    if (!data.user) {
        return cb.call(this, new Error(format('A user is required')));
    }
    if (this.validMoods.indexOf(data.mood) === -1) {
        return cb.call(this, new Error(format('Invalid mood %s; valid values are %s',
                                              data.mood, this.validMoods.join(', '))));
    }
    entry = format('%s:%s:%s', data.datetime, data.user, data.mood);
    this.exists({ date: data.datetime, user: data.user }, function(err, exists) {
        if (err) return cb.call(self, err);
        if (exists) {
            return cb.call(self, new Error(format('Mood already stored for %s on %s',
                                                  data.user, data.datetime)));
        }
        self.emit('info', format('storing mood entry for %s: %s', data.user, entry));
        self.client.rpush(self.redisKey, entry, function(err) {
            cb.call(self, err);
        });
    });
};
