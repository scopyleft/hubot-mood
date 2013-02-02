/*global describe it*/
var MoodEngine = require('./lib')
 ,  dateUtil   = require('./lib/date-util')
 ,  async      = require('async')
 ,  assert     = require('assert')
 ,  mocha      = require('mocha')
 ,  Url        = require('url')
 ,  Redis      = require('redis')
 ,  info       = Url.parse('redis://localhost:6379')
 ,  client     = Redis.createClient(info.port, info.hostname)
 ,  engine     = new MoodEngine(client, {
        redisKey: 'mood:test'
    });

engine.on('debug', function(message) {
    //console.log(message);
});

describe('#store()', function() {
    engine.clear();

    it("should store a user's mood", function(done) {
        engine.store({ user: "john", mood: "sunny" }, function(err) {
            assert(!err);
            assert(this instanceof MoodEngine)
            engine.query({ user: "john" }, function(err, moods) {
                assert(!err);
                assert.equal(moods.length, 1);
                assert.equal(moods[0].user, "john");
                assert.equal(moods[0].mood, "sunny");
                assert.equal(moods[0].date, dateUtil.datetime());
                done();
            });
        });
    });

    it("should't store a user's mood twice", function(done) {
        engine.store({ user: "john", mood: "sunny" }, function(err) {
            assert(err);
            done();
        });
    });

    it("should't store an invalid mood", function(done) {
        engine.store({ user: "bill", mood: "superman" }, function(err) {
            assert(err);
            done();
        });
    });

    it("should't store incomplete data", function(done) {
        engine.store({ user: "bill" }, function(err) {
            assert(err);
            engine.store({ mood: "sunny" }, function(err) {
                assert(err);
                done();
            });
        });
    });
});

describe('#query()', function() {
    it("should retrieve user moods", function(done) {
        engine.clear();

        async.series([
            function(cb) {
                engine.store({ user: "john", mood: "cloudy"}, function(err, result) {
                    cb(err, result);
                });
            },
            function(cb) {
                engine.store({ user: "bill", mood: "sunny"}, function(err, result) {
                    cb(err, result);
                });
            },
            function(cb) {
                engine.store({ user: "jane", mood: "rainy"}, function(err, result) {
                    cb(err, result);
                });
            }
        ], function(err, results) {
            engine.query(function(err, moods) {
                assert.equal(moods.length, 3);
                assert(moods.some(function(mood) {
                    return mood.user === "john" &&
                           mood.mood === "cloudy" &&
                           mood.date === dateUtil.datetime();
                }));
                assert(moods.some(function(mood) {
                    return mood.user === "bill" &&
                           mood.mood === "sunny" &&
                           mood.date === dateUtil.datetime();
                }));
                assert(moods.some(function(mood) {
                    return mood.user === "jane" &&
                           mood.mood === "rainy" &&
                           mood.date === dateUtil.datetime();
                }));
                done();
            });
        });
    });
});

describe('#exists()', function() {
    it("should checks if a user mood already exists", function(done) {
        engine.clear();
        async.series([
            function(cb) {
                engine.exists({ user: "john" }, function(err, exists) {
                    assert(!exists);
                    cb(err);
                });
            },
            function(cb) {
                engine.store({ user: "john", mood: "sunny" }, function(err) {
                    cb(err);
                });
            },
            function(cb) {
                engine.exists({ user: "john" }, function(err, exists) {
                    assert(exists);
                    cb(err);
                });
            }
        ], function(err, results) {
            done();
        });
    });
});

describe('#graph()', function() {
    it("should generate a graph for a user mood over time", function(done) {
        engine.clear();
        async.series([
            function(cb) {
                var date = dateUtil.datetime();
                engine.store({ user: "john", mood: "sunny", datetime: date}, function(err, result) {
                    cb(err, result);
                });
            },
            function(cb) {
                var date = dateUtil.datetime(dateUtil.daysBefore(1));
                engine.store({ user: "john", mood: "cloudy", datetime: date}, function(err, result) {
                    cb(err, result);
                });
            },
            function(cb) {
                var date = dateUtil.datetime(dateUtil.daysBefore(2));
                engine.store({ user: "john", mood: "rainy", datetime: date}, function(err, result) {
                    cb(err, result);
                });
            },
            function(cb) {
                var date = dateUtil.datetime(dateUtil.daysBefore(3));
                engine.store({ user: "john", mood: "stormy", datetime: date}, function(err, result) {
                    cb(err, result);
                });
            }
        ], function(err, results) {
            engine.graph({ user: "john", since: 3 }, function(err, graph) {
                assert(!err, err);
                assert.equal(graph, "▃▅▇");
                done();
            });
        });
    });
});
