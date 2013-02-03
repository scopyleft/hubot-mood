/*global describe it*/
var MoodEngine = require('../lib')
 ,  dateUtil   = require('../lib/date-util')
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

function load(engine, fixtures, onComplete) {
    async.series(fixtures.map(function(fixture) {
        return function(cb) {
            engine.store(fixture, function(err, result) {
                cb(err, result);
            });
        };
    }), onComplete);
}

describe('MoodEngine.Mood', function() {
    function createMood(data) {
        return function() {
            return new MoodEngine.Mood(data);
        };
    }

    it('should validate mood data', function() {
        assert.throws(createMood(), Error);
        assert.throws(createMood("foo"), Error);
        assert.throws(createMood({ user: "x" }), Error);
        assert.throws(createMood({ date: "2013-01-01" }), Error);
        assert.throws(createMood({ mood: "sunny" }), Error);
        assert.throws(createMood({ user: "x", mood: "wrong" }), /valid/);
        assert.doesNotThrow(createMood({ user: "x", mood: "sunny" }));
        var mood = createMood({ user: "x", mood: "sunny" })();
        assert.strictEqual(mood.date, dateUtil.today());
        assert.strictEqual(mood.user, "x");
        assert.strictEqual(mood.mood, "sunny");
    });

    it('should serialize data', function() {
        var mood = createMood({ user: "x", mood: "sunny", date: "2013-01-01" })();
        assert.strictEqual(mood.serialize(), "2013-01-01:x:sunny");
    });

    it('should get correct bar item', function() {
        assert.strictEqual(createMood({ user: "x", mood: "sunny" })().bar(), "▇");
        assert.strictEqual(createMood({ user: "x", mood: "cloudy" })().bar(), "▅");
        assert.strictEqual(createMood({ user: "x", mood: "rainy" })().bar(), "▃");
        assert.strictEqual(createMood({ user: "x", mood: "stormy" })().bar(), "▁");
    });

    it('should get correct symbol', function() {
        assert.strictEqual(createMood({ user: "x", mood: "sunny" })().symbol(), "☀");
        assert.strictEqual(createMood({ user: "x", mood: "cloudy" })().symbol(), "☁");
        assert.strictEqual(createMood({ user: "x", mood: "rainy" })().symbol(), "☂");
        assert.strictEqual(createMood({ user: "x", mood: "stormy" })().symbol(), "⚡");
    });

    it('should handle toString()', function() {
        assert.strictEqual(createMood({ user: "x", mood: "sunny", date: "2013-01-01" })().toString(),
                     "On 2013-01-01, x was on a sunny mood ☀");
        assert.strictEqual(createMood({ user: "x", mood: "rainy", date: dateUtil.yesterday() })().toString(),
                     "Yesterday, x was on a rainy mood ☂");
        assert.strictEqual(createMood({ user: "x", mood: "cloudy" })().toString(),
                     "Today, x is on a cloudy mood ☁");
    });

    it('should parse serialized data', function() {
        var source = "2013-01-01:x:sunny"
          , mood = MoodEngine.Mood.parse(source);
        assert.strictEqual(source, mood.serialize());
    });
});

describe('MoodEngine', function() {
    describe('#store()', function() {
        engine.clear();

        it("should store a user's mood", function(done) {
            engine.store({ user: "john", mood: "sunny" }, function(err) {
                assert.ifError(err);
                assert(this instanceof MoodEngine, "Callback context is set to the MoodEngine instance");
                engine.query({ user: "john" }, function(err, moods) {
                    assert.ifError(err);
                    assert.strictEqual(moods.length, 1);
                    assert(moods[0] instanceof MoodEngine.Mood, "A retrieved mood is a Mood instance");
                    assert.strictEqual(moods[0].user, "john");
                    assert.strictEqual(moods[0].mood, "sunny");
                    assert.strictEqual(moods[0].date, dateUtil.datetime());
                    done();
                });
            });
        });

        it("shouldn't store a user's mood twice", function(done) {
            engine.store({ user: "john", mood: "sunny" }, function(err) {
                assert(err);
                done();
            });
        });

        it("shouldn't store an invalid mood", function(done) {
            engine.store({ user: "bill", mood: "superman" }, function(err) {
                assert(err);
                done();
            });
        });

        it("shouldn't store incomplete data", function(done) {
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
            load(engine, [
                { user: "john", mood: "cloudy" },
                { user: "john", mood: "cloudy", date: dateUtil.yesterday() },
                { user: "bill", mood: "sunny" },
                { user: "jane", mood: "rainy" }
            ], function(err, results) {
                results.forEach(function(mood) {
                    assert(mood instanceof MoodEngine.Mood);
                });
                engine.query(function(err, moods) {
                    assert.ifError(err);
                    assert.strictEqual(moods.length, 4);
                    assert(moods.some(function(mood) {
                        return mood.user === "john" && mood.mood === "cloudy" &&
                               mood.date === dateUtil.today();
                    }));
                    assert(moods.some(function(mood) {
                        return mood.user === "bill" && mood.mood === "sunny" &&
                               mood.date === dateUtil.today();
                    }));
                    assert(moods.some(function(mood) {
                        return mood.user === "jane" && mood.mood === "rainy" &&
                               mood.date === dateUtil.today();
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
                assert.ifError(err);
                done();
            });
        });
    });

    describe('#graph()', function() {
        it("should generate a graph for a user mood over time", function(done) {
            engine.clear();
            load(engine, [
                { user: "john", mood: "sunny", date: dateUtil.today()},
                { user: "john", mood: "cloudy", date: dateUtil.daysBefore(1)},
                { user: "john", mood: "rainy", date: dateUtil.daysBefore(2)},
                { user: "john", mood: "stormy", date: dateUtil.daysBefore(3)},
                { user: "bill", mood: "stormy", date: dateUtil.today()},
                { user: "bill", mood: "stormy", date: dateUtil.daysBefore(1)},
            ], function(err, results) {
                engine.graph({ user: "john", since: 3 }, function(err, graph) {
                    assert.ifError(err);
                    assert.strictEqual(graph, "▃▅▇");
                    engine.graph({ user: "john", since: 2 }, function(err, graph) {
                        assert.ifError(err);
                        assert.strictEqual(graph, "▅▇");
                        done();
                    });
                });
            });
        });
    });
});
