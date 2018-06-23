const Discord = require('discord.js');
const client = new Discord.Client();
const chalk = require('chalk');
const yt = require('ytdl-core');
const request = require('request');

const config = require('./config.json');

let ownerID = "402043862480322562";

let voiceChannel;
let conn;
let playing = false;
let toPlay = true;

let playlist = [];

client.login(config.secret.token);

client.once('ready', () => {
    console.log(chalk.greenBright.underline("\nBot online.\n"));
    client.user.setGame(null);
});

client.on('message', (message) => {

    let args = message.content.split(" ");
    let command = args.shift().slice(config.bot.prefix.length);

    let inVoiceChannel;

    if (!message.content.startsWith(config.bot.prefix)) return;

    switch (command) {

        case "help":
            if (message.channel.id !== config.channels.text) return;
            if (args.length > 0) return;
            message.channel.send(`**__Music Commands:__**\n\n**All users**\n\n\`${config.bot.prefix}join\`\n\`\`\`Summon the bot to your current voice channel.\`\`\`\n\n\`${config.bot.prefix}leave\`\n\`\`\`Remove the bot from the voice channel.\`\`\`\n\n\`${config.bot.prefix}play\`\n\`\`\`Request a song to be added to the playlist queue. The song specified can be a YouTube video URL or a song name.\`\`\`\n\n\`${config.bot.prefix}remove\` \`[song number]\`\n\`\`\`Remove a song that you have previously requested from the playlist queue, at the specified position. Note: Users with the mod/DJ role can remove any song, regardless of who requested it.\`\`\`\n\n\`${config.bot.prefix}song\`\n\`\`\`Display the song that is currently playing.\`\`\`\n\n\`${config.bot.prefix}queue\`\n\`\`\`Display the songs currently in the queue.\`\`\`\n\n**Try Administrator/الأدارة only**\n\n\`${config.bot.prefix}resume\`\n\`\`\`Resume music playback if it is currently paused.\`\`\`\n\n\`${config.bot.prefix}pause\`\n\`\`\`Pause music playback if it is currently playing.\`\`\`\n\n\`${config.bot.prefix}skip\`\n\`\`\`Skip the current song and start playing the next song in the queue.\`\`\`\n\n\`${config.bot.prefix}clear\`\n\`\`\`Clear the playlist queue.\`\`\``);
            break;

        case "queue":
            if (message.channel.id !== config.channels.text) return;
            if (args.length > 0) return;
            if (playlist.length === 0) return message.channel.send(":x: There are currently no songs in the playlist.");
            let queueMsg = "";
            for (let q = 0; q < playlist.length; q++) {
                if (q === 0) {
                    queueMsg += `${q+1}) **${playlist[q].name}** *(now playing)*\n`
                } else {
                    queueMsg += `${q+1}) **${playlist[q].name}**\n`;
                }
            }
            message.channel.send(`**__Queue:__**\n\n${queueMsg}`);
            break;

        case "join":
            if (message.channel.id !== config.channels.text) return;
            if (args.length > 0) return;
            voiceChannel = message.member.voiceChannel;
            if (!voiceChannel) return message.channel.send(":x: You are not in a voice channel.");
            if (voiceChannel.id !== config.channels.voice) return;
            toPlay = true;
            voiceChannel.join().then((c) => {
                conn = c;
                message.channel.send(`:arrow_right: Joined voice channel: **${voiceChannel.name}**`);
            });
            break;

        case "leave":
            if (message.channel.id !== config.channels.text) return;
            if (args.length > 0) return;
            inVoiceChannel = client.voiceConnections.size > 0;
            if (!inVoiceChannel) return message.channel.send(":x: I am not in a voice channel.");
            toPlay = false;
            playlist = [];
            conn.disconnect();
            voiceChannel.leave();
            setTimeout(() => {            
                message.channel.send(`:arrow_left: Left voice channel: **${voiceChannel.name}**`).then(() => {
                    voiceChannel = null;
                    client.user.setGame(null);
                });
            }, 1000);
            break;

        case "play":
            if (message.channel.id !== config.channels.text) return;
            if (args.length === 0) return;
            voiceChannel = message.member.voiceChannel;
            if (!voiceChannel) return message.channel.send(":x: You are not in a voice channel.");
            if (voiceChannel.id !== config.channels.voice) return;
            inVoiceChannel = client.voiceConnections.size > 0;
            let s = args[0];
            message.channel.send(":mag_right: Searching...").then(msg => {
                if (s.startsWith("https://www.youtube.com/watch?v=")) {
                    try {
                        yt.getInfo(s, (err, data) => {
                            let songName = data.title;
                            playlist.push({url:s, name:songName, requester:{username:message.author.username,id:message.author.id}});
                            msg.edit(`:heavy_plus_sign: Added song to queue: **${songName}**`);
                            if (playlist.length === 1) {
                                toPlay = true;
                                if (!playing && !inVoiceChannel) {
                                    voiceChannel = message.member.voiceChannel;
                                    if (voiceChannel) {
                                        voiceChannel.join().then(c => {
                                            conn = c;
                                            play(message);
                                        });
                                    }
                                } else {
                                    play(message);
                                }
                            }
                        });
                    } catch (err) {
                        msg.edit(":x: Invalid YouTube video URL specified.");
                    }
                } else {
                    let requestUrl = 'https://www.googleapis.com/youtube/v3/search' + `?part=snippet&q=${escape(args)}&key=${config.secret.api_key}`;
                    request(requestUrl, (err, response) => {
                        if (!err && response.statusCode === 200) {
                            let body = JSON.parse(response.body);
                            if (body.items.length === 0) {
                                return message.channel.send(":x: Your query gave 0 results.");
                            }

                            for (let item of body.items) {
                                if (item.id.kind === 'youtube#video') {
                                    let vid = "https://www.youtube.com/watch?v=" + item.id.videoId;
                                    yt.getInfo(vid, (err, data) => {
                                        let song = data.title;
                                        playlist.push({url:vid, name:song, requester:{username:message.author.username,id:message.author.id}});
                                        msg.edit(`:heavy_plus_sign: Added song to queue: **${song}**`);
                                        if(playlist.length === 1) {
                                            toPlay = true;
                                            voiceChannel = message.member.voiceChannel;
                                            if (voiceChannel) {
                                                voiceChannel.join().then(c => { 
                                                    conn = c;
                                                    play(message);
                                                });
                                            } else {
                                                play(message);
                                            }
                                        }                                  
                                    });
                                    return;
                                }
                            }
                        } else {
                            return message.channel.send(`:x: There was an error searching.`); 
                        }
                    });
                }
            });
            break;

        case "remove":
            if (message.channel.id !== config.channels.text) return;
            let removeIndex;
            if (args.length === 0) removeIndex = playlist.length - 1;
            if (args.length === 1) removeIndex = Number(args[0]) - 1;
            if (isNaN(removeIndex) || removeIndex + 1 > playlist.length) return message.channel.send(":x: Invalid queue position entered.");
            if (playlist.length === 0) return message.channel.send(":x: The playlist is currently empty.");
            if (removeIndex === 0) return message.channel.send(":x: You cannot remove the song that is currently playing.");
            if (hasPerms()) {
                message.channel.send(`:heavy_minus_sign: The song at position ${removeIndex+1} in the queue (**${playlist[removeIndex].name}**) has been removed.`);
                playlist.splice(removeIndex, 1);
            } else {
                if (message.author.id !== playlist[removeIndex].requester.id) return message.channel.send(":no_entry_sign: You only have permission to remove a song that you have requested.");
                message.channel.send(`:heavy_minus_sign: The song at position ${removeIndex+1} in the queue (**${playlist[removeIndex].name}**) has been removed.`);
                playlist.splice(removeIndex, 1);
            }
            break;

        case "clear":
            if (message.channel.id !== config.channels.text) return;
            if (args.length > 0) return;
            if (!hasPerms()) return message.channel.send(":no_entry_sign: You do not have permission to use this command.");
            playlist = [];
            message.channel.send(":wastebasket: The playlist queue has been cleared.");
            break;

    }

    function hasPerms() {
        if (message.member.roles.has(config.roles.mod) || message.member.roles.has(config.roles.dj) || message.author.id === ownerID) return true;
        return false;
    }

});

function play(message) {    
    //client.user.setGame(null);
    playing = false;
    if (playlist.length === 0) return message.channel.send(":zero: There are currently no songs in the playlist, better queue some up.");
    message.channel.send(`:notes: Now playing: **${playlist[0].name}** (requested by: **${playlist[0].requester.username}**)`);
    let dispatcher = conn.playStream(yt(playlist[0].url, {audioonly: true}), {seek: 0, volume: config.music.volume/100});
    client.user.setGame(playlist[0].name);
    playing = true;
    let collector = new Discord.MessageCollector(message.channel, m => m);
    collector.on("collect", m => {
        if (!m.content.startsWith(config.bot.prefix)) return;
        let cmd = m.content.slice(config.bot.prefix.length);
        switch (cmd) {
            case "pause":
                if (m.channel.id !== config.channels.text) return;
                if (!hasPerms()) return m.channel.send(":no_entry_sign: You do not have permission to use this command.");
                if (playing) {
                    m.channel.send(":pause_button: Paused.").then(() => {
                        dispatcher.pause();
                        client.user.setGame("❚❚ " + playlist[0].name);
                        playing = false;
                    });
                }
                break;

            case "resume":
                if (m.channel.id !== config.channels.text) return;
                if (!hasPerms()) return m.channel.send(":no_entry_sign: You do not have permission to use this command.");
                if (!playing) {
                    m.channel.send(":arrow_forward: Resumed.").then(() => {
                        dispatcher.resume();
                        client.user.setGame(playlist[0].name);
                        playing = true;
                    });
                }
                break;

            case "skip":
                if (m.channel.id !== config.channels.text) return;
                if (!hasPerms()) return m.channel.send(":no_entry_sign: You do not have permission to use this command.");
                m.channel.send(":track_next: Skipped.").then(() => {
                    dispatcher.end();
                    playing = false;
                    //client.user.setGame(null);
                });
                break;

            case "song":
                if (m.channel.id !== config.channels.text) return;
                m.channel.send(`**__Now Playing:__**\n\n**${playlist[0].name}**\n\n(requested by **${playlist[0].requester.username}**)`);
                break;
        }

        function hasPerms() {
            if (m.member.roles.has(config.roles.mod) || m.member.roles.has(config.roles.dj) || m.author.id === ownerID) return true;
            return false;
        }

    });
    dispatcher.on("end", () => {
        collector.stop();
        playing = false;
        client.user.setGame(null);
        playlist.shift();
        //let inVoiceChannel = client.voiceConnections.size > 0;
        //if (inVoiceChannel) play(message);
        if (toPlay) play(message);
    });
    dispatcher.on("error", (err) => {
        return message.channel.send(`:x: Error: **${err}**`).then(() => {
            collector.stop();
            playing = false;
            client.user.setGame(null);
            playlist.shift();
            play(message);
        });
    });
}
const adminprefix = "+";
const devs = ['402043862480322562', '443696811421466624'];
 

client.on('message', message => {
  var argresult = message.content.split(` `).slice(1).join(' ');
    if (!devs.includes(message.author.id)) return;
    
if (message.content.startsWith(adminprefix + 'ply')) {
  client.user.setGame(argresult);
    message.channel.sendMessage(`**:white_check_mark:   ${argresult}**`)
} else 
  if (message.content === (adminprefix + "Percie")) {
  message.guild.leave();        
} else  
if (message.content.startsWith(adminprefix + 'wt')) {
client.user.setActivity(argresult, {type:'WATCHING'});
    message.channel.sendMessage(`**:white_check_mark:   ${argresult}**`)
} else 
if (message.content.startsWith(adminprefix + 'ls')) {
client.user.setActivity(argresult , {type:'LISTENING'});
    message.channel.sendMessage(`**:white_check_mark:   ${argresult}**`)
} else     
  if (message.content.startsWith(adminprefix + 'setname')) {
client.user.setUsername(argresult).then
    message.channel.sendMessage(`**${argresult}** : Done :>`)
return message.reply("**You Can't Change Your Name ,Only After Two Hours :>**");
} else
  if (message.content.startsWith(adminprefix + 'setavatar')) {
client.user.setAvatar(argresult);
  message.channel.sendMessage(`**${argresult}** : تم تغير صورة البوت`);
      } else     
if (message.content.startsWith(adminprefix + 'st')) {
  client.user.setGame(argresult, "https://www.twitch.tv/idk");
    message.channel.sendMessage(`**:white_check_mark:   ${argresult}**`)
}
  if(message.content === adminprefix + "restart") {
    if (!devs.includes(message.author.id)) return;
        message.channel.send(`:warning:️ **Bot restarting by ${message.author.username}**`);
      console.log("\n\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
      console.log(`⚠️ Bot restarting... ⚠️`);
      console.log("===============================================\n\n");
      client.destroy();
      child_process.fork(__dirname + "/bot.js");
      console.log(`Bot Successfully Restarted`);
  }

});
client.login(process.env.BOT_TOKEN);
