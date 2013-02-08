# hubot-mood

A simple [hubot](http://hubot.github.com/) script to store your team's mood and get some metrics about it.

## Installation

You have of course to get a working [installation of hubot](https://github.com/github/hubot/blob/master/src/templates/README.md#readme) first.

Add `hubot-mood` to the `package.json` of your hubot setup, then `npm install` it.

Storage is done through [redis](http://redis.io/). You have to set the redis url into the `HUBOT_MOOD_REDIS_URL` env var, eg.:

```
export HUBOT_MOOD_REDIS_URL=redis://user:password@dory.redistogo.com:9553/
```

Last, link the `mood.js` bot script into your own `scripts` folder:

```
ln -sf ../node_modules/hubot-mood/scripts/mood.js scripts/mood.js
```

By default, it will try to use `redis://localhost:6379`.

## Commands

The bot will respond to several commands:

```
mood set "<sunny|cloudy|rainy|stormy>" (optional info)
mood of|for <(nickname)|me>
mood today
mood yesterday
mood week of|for <(nickname)|me>
mood month of|for <(nickname)|me>
```

Demo (purely fictional, if you asked):

```
<NiKo`> scopybot: mood set sunny Let the Sunshine In
<scopybot> Recorded entry: Today, NiKo` is in a sunny mood ☀ (Let the Sunshine In)
<NiKo`> scopybot: mood today
<scopybot> Today's moods:
<scopybot> - Today, NiKo` is in a sunny mood ☀ (Let the Sunshine In)
<scopybot> - Today, pointbar is in a sunny mood ☀
<scopybot> - Today, vinyll is in a sunny mood ☀
<scopybot> - Today, david`bgk is in a sunny mood ☀
<NiKo`> scopybot: mood yesterday
<scopybot> Yesterday's moods:
<scopybot> - Yesterday, NiKo` was in a cloudy mood ☁
<scopybot> - Yesterday, pointbar was in a sunny mood ☁
<scopybot> - Yesterday, vinyll was in a sunny mood ☀
<scopybot> - Yesterday, david`bgk was in a sunny mood ☀
<NiKo`> scopybot: mood week of NiKo`
▃▅▇▅▃▅▇
<NiKo`> scopybot: mood month of NiKo`
▃▅▇▅▃▅▇▃▅▇▅▃▅▇▃▅▇▅▃▅▇▃▅▇▇▅▇▅▇
```

> **Note:** your client must support unicode and be configured accordingly in order to see the fancy pictograms.

To play around with the commands, just run the `hubot` command at the root of the repository:

```
$ hubot
Hubot> hubot mood set unhappy
Hubot> Error: Invalid mood unhappy; valid values are sunny, cloudy, rainy, stormy
Hubot> hubot mood set sunny Let the Sunshine In
Recorded entry: Today, Shell is in a sunny mood ☀ (Let the Sunshine In)
```

> **Note:** yes, *Shell* is your username by default when testing locally. I have no idea how to prevent this.

## Tests

Install [mocha](http://visionmedia.github.com/mocha/) and [async](https://github.com/caolan/async), then run the suite from the root of the repository by running the `mocha` command.

**Note:** Testing requires a live redis server instance running on `redis://localhost:6379`. Don't worry, it won't erase your data.

## Why?

Because sharing our mood is informative and ease collaboration.

## License

MIT.
