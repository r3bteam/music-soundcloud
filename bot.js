/* This bot uses the SoundCloud API, without it the bot would not be possible
   https://developers.soundcloud.com/
*/

var VOLUME = 0.1;
var PLAYLISTS = ["SOUNDCLOUD PLAYLISTS IN THIS ARRAY"];
var SOUNDCLOUD_URL = "https://soundcloud.com/";
var YOUTUBE_URL = "https://www.youtube.com/watch"

// Text for help command
var GO = "~go -          SoundCloudBot joins the voice channel in which the sender is in and starts playing";
var STOP = "~stop -      SoundCloudBot leaves the voice channel it is in";
var PAUSE = "~pause -    SoundCloudBot pauses what is currently being played";
var RESUME = "~resume -  SoundCloudBot resumes what is currently being played after being paused";
var NEXT = "~next -      SoundCloudBot skips the song which is currently playing";
var ADD =  "~add <URL> - SoundCloudBot adds the track provided by the URL";
var HELP = [GO, STOP, PAUSE, RESUME, NEXT, ADD];

var request = require("request");
var youtubeStream = require("youtube-audio-stream");
var Discord = require("discord.js");
var bot = new Discord.Client();
var CLIENTID = "95f22ed54a5c297b1c41f72d713623ef";

// Add a couple of features to arrays (for use in tracks array)
Array.prototype.current = -1;
Array.prototype.next = function() {
	this.current++;
	if (this.current >= this.length) {
		this.current = 0;
	}
	return this[this.current];
}


/***************************
	SOUNDCLOUD FUNCTIONS
***************************/

// Resolves a soundcloud URL to JSON format
function scResolve(url, ret) {
	var result;
	request("https://api.soundcloud.com/resolve?url=" + url + "&client_id=" + CLIENTID, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log("Successfully resolved " + url);
			result = JSON.parse(body);
			ret(result);
		}
		else {
			console.log("Failed to reslove " + url);
			ret(0);
		}
	});
}


/************************
	DISCORD FUNCTIONS
************************/

// starts playing the next track
function next(connection) {
	connection.stopPlaying();
}

// plays the next track in the queue or the next track in the user added tracks if there are any
function play(connection, tracks, userTracks, nowPlaying) {
	var track;
	var sound;
	var title;
	var stream;
	var stream_url;
	var url;				// url of the track being played
	var streamOK = false;

	// get the next track
	if (userTracks.length == 0) {
		// ensure there is something to play
		if (tracks.length == 0) {
			console.log("ERROR: Nothing to play!");
			return;
		}
		else {
			// shuffle the tracks if back at the start
			if (tracks.current == 0) {
				console.log("Shuffling tracks");
				shuffle(tracks);
			}
			track = tracks.next();
			title = track.title;
			stream_url = track.stream_url;
			url = track.permalink_url;
			stream = request(stream_url + "?&client_id=" + CLIENTID);
			console.log("Chosen to play " + title + " from default tracks loop");
		}
	}
	// if there is a track added by a user, play that instead
	else {
		sound = userTracks.shift();
		// get informatoin if track is from soundcloud
		if (sound.kind === 'soundcloud') {
			title = sound.data.title;
			url = sound.data.permalink_url;
			stream_url = sound.data.stream_url;
			stream = request(stream_url + "?&client_id=" + CLIENTID);
		}
		// get information if track is from youtube
		else if (sound.kind === 'youtube') {
			title = sound.data;
			url = sound.data;
			stream_url = sound.data
			try {
				stream = youtubeStream(stream_url);
			}
			catch (exception) {
				console.log("Failed to get youtube audio stream from " + stream_url);
			}
		}
		console.log("Chosen to play " + title + " from user added tracks");
	}

    // play the stream
    connection.playRawStream(stream, {volume: VOLUME}, function(error, intent) {
    	// log errors
    	if (error) {
    		console.log("Failed to play " + title);
    		console.log(error);
    	}
    	// if an error didn't occur log what is playing and set up the next song to play on the end of this song
    	else {
    		console.log("Starting to play " + title);
    		intent.on("end", function() {
   				play(connection, tracks, userTracks, nowPlaying);
    		});
    	}
    });

    nowPlaying(url);
}

/*********************
	MISC FUNCTIONS
*********************/

// shuffle function from here: http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
// shuffles the order of elements in an array a
function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i -= 1) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}

// returns an array of all tracks from each playlist in playlists (JSON representaation straight from SoundCloud)
function loadPlaylists(playlists, ret) {
	var nplaylists = playlists.length;
	var waiting = nplaylists;
	var result;
	var playlist;
	var allTracks = [];

	// iterate through playlists
	for (var i=0; i<nplaylists; i++) {
		playlist = playlists[i];
		// resolve the URL into JSON format
		scResolve(playlist, function(result) {
			if (result != 0) {
				// Put all tracks into the track array
				allTracks = allTracks.concat(result.tracks);
				console.log(result.tracks.length + " tracks succesfully loaded from " + playlist);
			}
			// return if we have added everything we need to
			if (--waiting == 0) {
				ret(allTracks);
			}
		});
	}
}

// constructer for making objects the player will recognise
function Sound(kind, data) {
	this.kind = kind;
	this.data = data;
}


/***********
	MAIN
***********/
var tracks = [];			// default loop of tracks
var userTracks = [];		// queue of tracks added by users
var joined = false;			// whether or not soundcloud bot is currently in a voice channel playing

// Set up help
var nhelp = HELP.length;
var helpStr = "";
for (var i=0; i<nhelp; i++) {
	helpStr = helpStr + HELP[i] + '\n';
}

// load in the playlists
loadPlaylists(PLAYLISTS, function(result) {
	tracks = result;
	console.log("Successfully loaded " + tracks.length + " tracks");
	console.log("Shuffling tracks");
	shuffle(tracks);
	// login to discord once tracks are all loaded in
	console.log("Logging in...");
	bot.login("ACCOUNT EMAIL HERE", "ACCOUNT PASSWORD HERE");

	console.log("Ready");
});

// message event handler
bot.on("message", function(message) {
	var user = message.author;
    var tchannel = message.channel;
    var content = message.content;

	if (content.charAt(0) === '~' && tchannel.name == "bots") {
		console.log(user.username + ": 		" + content);
		// the go command, joins voice channel and starts playing
		if (content === "~go") {
			if (!joined) {
				bot.joinVoiceChannel(user.voiceChannel, function (error, connection) {
                	if (error) {
                		console.log("Failed to join voice channel");
                    	bot.sendMessage(tchannel, "Failed to join, sorry!!");
                	}
                	else {
                		console.log("Successfully joined voice channel");
                    	bot.sendMessage(tchannel, "I'm here for your soundcloud needs bb.");
                    	joined = true;
                    	play(connection, tracks, userTracks, function (url) {
                    		bot.sendMessage(tchannel, "Now playing " + url);
                    	});
                	}
            	});
			}
		}

		// the stop command, leaves voice channel
		else if (content === "~stop") {
			if (joined) {
				console.log("Stopping...")
				joined = false;
				bot.voiceConnection.destroy();
			}
		}

		// the pause command, pauses current playback
		else if (content === "~pause") {
			if (joined) {
				console.log("Pausing...")
				bot.voiceConnection.pause();
			}
		}

		// the resume command, resumes paused playback
		else if (content === "~resume") {
			if (joined) {
				console.log("Resuming...")
				bot.voiceConnection.resume();
			}
		}

		// the next command, skips the current song
		else if (content === "~next" || content === "skip") {
			if (joined) {
				console.log("Skipping...");
				bot.voiceConnection.resume();
				next(bot.voiceConnection);
			}
		}

		// the add command, adds a specified track to the user added tracks
		else if (content.startsWith("~add")) {
			var sound;

			//retrieve ulr from message
			var args = content.split(" ");
			url = args[1];
			console.log("Trying to add " + url + "to user tracks");

			// case for soundcloud url
			if (url.substring(0, SOUNDCLOUD_URL.length) === SOUNDCLOUD_URL) {
				// try resolve the url
        		scResolve(url, function(ret) {
        			// make sure it can be streamed
        			if (!ret.hasOwnProperty('stream_url')) {
    					bot.reply(message, "I can't stream that, double check you've linked a track!");
    					console.log("Failed to add " + url + ", can't find stream");
    				}
    				// add the track to the queue
    				else {
    					sound = new Sound("soundcloud", ret);
    					userTracks.push(sound);
    					bot.reply(message, "added " + ret.title);
    					console.log("Added " + url + " to the user tracks queue");
    				}
        		});
        	}

        	// case for youtube url
        	else if (url.substring(0, YOUTUBE_URL.length) === YOUTUBE_URL) {
        		sound = new Sound("youtube", url);
        		userTracks.push(sound);
        		bot.reply(message, "added " + url);
    			console.log("Added " + url + " to the user tracks queue");
        	}

        	// error if the url is not for soundcloud or youtube
        	else {
        		bot.reply(message, "At the moment non-SoundCloud links aren't supported, make sure your link starts with " + SOUNDCLOUD_URL);
        		console.log("Failed to add " + url + ", unsupported link");
        	}
		}

		// the help command, list all of the commands and what they do
		else if (content === "~help") {
			console.log("Providing help");
			bot.reply(message, "\n" + helpStr);
		}
	}
	else if (tchannel.name != "bots" && content.charAt(0) === '~') {
		bot.reply(message, "I'm not doing shit until you talk to me in #bots");
	}
});

// every hour re-join the voice channel
setInterval(function () {
	if (joined) {
		vchannel = bot.voiceConnection.voiceChannel;
		bot.voiceConnection.destroy();
		bot.joinVoiceChannel(vChannel, function (error, connection) {
                	if (error) {
                		console.log("Failed to join voice channel");
                	}
                	else {
                		console.log("Successfully joined voice channel");
                    	play(connection, tracks, userTracks, function (url) {
                    		bot.sendMessage(tchannel, "Now playing " + url);
                    	});
                	}
            	});
	}
}, 3600000);

bot.login(process.env.BOT_TOKEN);
