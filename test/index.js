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
        assert.doesNotThrow(createMood({ user: "x", mood: "sunny", info: "plop" }));
        var mood = createMood({ user: "x", mood: "sunny", info: "plop" })();
        assert.strictEqual(mood.date, dateUtil.today());
        assert.strictEqual(mood.user, "x");
        assert.strictEqual(mood.mood, "sunny");
        assert.strictEqual(mood.info, "plop");
    });

    it('should serialize data', function() {
        var mood1 = createMood({ user: "x", mood: "sunny", date: "2013-01-01" })();
        assert.strictEqual(mood1.serialize(), "2013-01-01:x:sunny");
        var mood2 = createMood({ user: "x", mood: "sunny", date: "2013-01-01", info: "plop" })();
        assert.strictEqual(mood2.serialize(), "2013-01-01:x:sunny:plop");
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
                     "On 2013-01-01, x was in a sunny mood ☀");
        assert.strictEqual(createMood({ user: "x", mood: "rainy", date: dateUtil.yesterday() })().toString(),
                     "Yesterday, x was in a rainy mood ☂");
        assert.strictEqual(createMood({ user: "x", mood: "cloudy" })().toString(),
                     "Today, x is in a cloudy mood ☁");
        assert.strictEqual(createMood({ user: "x", mood: "sunny", date: "2013-01-01", info: "plop" })().toString(),
                     "On 2013-01-01, x was in a sunny mood ☀ (plop)");
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

        it("should store a user's mood with info", function(done) {
            engine.store({ user: "mark", mood: "sunny", info: "plop" }, function(err) {
                assert.ifError(err);
                engine.query({ user: "mark" }, function(err, moods) {
                    assert.ifError(err);
                    assert.strictEqual(moods[0].user, "mark");
                    assert.strictEqual(moods[0].info, "plop");
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

        it("shouldn't store a user's mood with info twice", function(done) {
            engine.store({ user: "mark", mood: "sunny", info: "plop" }, function(err) {
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

        it("should filter moods", function(done) {
            engine.clear();
            var moods = [
                { user: "john", mood: "sunny" },
                { user: "john", mood: "cloudy", date: dateUtil.yesterday() },
                { user: "john", mood: "rainy", date: dateUtil.daysBefore(2) },
                { user: "bill", mood: "rainy" },
                { user: "bill", mood: "cloudy", date: dateUtil.yesterday() },
                { user: "bill", mood: "sunny", date: dateUtil.daysBefore(2) },
                { user: "jane", mood: "sunny" },
                { user: "jane", mood: "sunny", date: dateUtil.yesterday() },
                { user: "jane", mood: "sunny", date: dateUtil.daysBefore(2) }
            ];
            async.map(moods, engine.store.bind(engine), function(err, moods) {
                assert.ifError(err);
                assert.equal(moods.length, 9);
                assert.equal(engine.filter(moods, { user: "john" }).length, 3);
                assert.equal(engine.filter(moods, { user: "bill" }).length, 3);
                assert.equal(engine.filter(moods, { user: "jane" }).length, 3);
                assert.equal(engine.filter(moods, { since: 1 }).length, 3);
                assert.equal(engine.filter(moods, { user: "john", since: 1 }).length, 1);
                assert.equal(engine.filter(moods, { mood: "sunny" }).length, 5);
                assert.equal(engine.filter(moods, { mood: ["rainy", "cloudy"] }).length, 4);
                done();
            });
        });
    });

    describe('#query()', function() {
        it("should retrieve user moods", function(done) {
            engine.clear();
            var moods = [
                { user: "john", mood: "cloudy" },
                { user: "john", mood: "cloudy", date: dateUtil.yesterday() },
                { user: "bill", mood: "sunny" },
                { user: "jane", mood: "rainy", info: "plop" }
            ];
            async.map(moods, engine.store.bind(engine), function(err, results) {
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
                               mood.date === dateUtil.today() &&
                               mood.info === "plop";
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
            var moods = [
                { user: "john", mood: "sunny", date: dateUtil.today(), info: "plop"},
                { user: "john", mood: "cloudy", date: dateUtil.yesterday()},
                { user: "john", mood: "rainy", date: dateUtil.daysBefore(2)},
                { user: "john", mood: "stormy", date: dateUtil.daysBefore(3)},
                { user: "bill", mood: "stormy", date: dateUtil.today()},
                { user: "bill", mood: "stormy", date: dateUtil.yesterday()},
            ];
            async.map(moods, engine.store.bind(engine), function(err, results) {
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
