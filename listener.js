
var named = require('named-regexp').named;
var dns = require('dns');
var dgram = require('dgram');
var s = dgram.createSocket('udp4');
var SteamID = require('steamid');
var servers = {};
var localIp = require('ip').address();
var myip;
const rcon = require('rcon-srcds');

var nconf = require('nconf');
nconf.file({
	file: 'genbby_config.json'
});

var myport = nconf.get('port');
var rcon_pass = nconf.get('default_rcon');
var server_config = nconf.get('server');
var serverType = nconf.get('serverType');

String.prototype.format = function () {
	var formatted = this;
	for (var i = 0; i < arguments.length; i++) {
		var regexp = new RegExp('\\{' + i + '\\}', 'gi');
		formatted = formatted.replace(regexp, arguments[i]);
	}
	return formatted;
};

s.on('message', function (msg, info) {
	var addr = info.address + ':' + info.port;
	var text = msg.toString(),
		param, cmd, re, match;

	if (servers[addr] === undefined && addr.match(/(\d+\.){3}\d+/)) {
		servers[addr] = new Server(String(addr), String(rcon_pass));
	}
	console.log(text);

	// connected
	re = named(/"(:<user_name>.+)[<](:<user_id>\d+)[>][<](:<steam_id>.*)[>]<>" entered the game/);
	match = re.exec(text);
	if (match !== null) {
		if (match.capture('steam_id') != 'BOT') {
			var conGameId = match.capture('user_id')
			var conName = match.capture('user_name');
			var conId = match.capture('steam_id');
			var conId64 = id64(conId);
			console.log('real player connected: ' + conName + ' gameId: ' + conGameId);
		}
	}

	// join team
	re = named(/"(:<user_name>.+)[<](:<user_id>\d+)[>][<](:<steam_id>.*)[>]" switched from team [<](:<user_team>CT|TERRORIST|Unassigned|Spectator)[>] to [<](:<new_team>CT|TERRORIST|Unassigned|Spectator)[>]/);
	match = re.exec(text);
	if (match !== null) {
		if (servers[addr].state.players[match.capture('steam_id')] === undefined) {
			if (match.capture('steam_id') != 'BOT') {
				servers[addr].state.players[match.capture('steam_id')] = new Player(match.capture('steam_id'), match.capture('new_team'), match.capture('user_name'), undefined);
			}
		} else {
			servers[addr].state.players[match.capture('steam_id')].steamid = match.capture('steam_id');
			servers[addr].state.players[match.capture('steam_id')].team = match.capture('new_team');
			servers[addr].state.players[match.capture('steam_id')].name = match.capture('user_name');
		}
		servers[addr].lastlog = +new Date();
	}

	// clantag
	re = named(/"(:<user_name>.+)[<](:<user_id>\d+)[>][<](:<steam_id>.*?)[>][<](:<user_team>CT|TERRORIST|Unassigned|Spectator)[>]" triggered "clantag" \(value "(:<clan_tag>.*)"\)/);
	match = re.exec(text);
	if (match !== null) {
		if (servers[addr].state.players[match.capture('steam_id')] === undefined) {
			if (match.capture('steam_id') != 'BOT') {
				servers[addr].state.players[match.capture('steam_id')] = new Player(match.capture('steam_id'), match.capture('user_team'), match.capture('user_name'), match.capture('clan_tag'));
			}
		} else {
			servers[addr].state.players[match.capture('steam_id')].clantag = match.capture('clan_tag') !== '' ? match.capture('clan_tag') : undefined;
		}
		servers[addr].lastlog = +new Date();
	}

	// disconnect
	re = named(/"(:<user_name>.+)[<](:<user_id>\d+)[>][<](:<steam_id>.*)[>][<](:<user_team>CT|TERRORIST|Unassigned|Spectator)[>]" disconnected/);
	match = re.exec(text);
	if (match !== null) {
		if (servers[addr].state.players[match.capture('steam_id')] !== undefined) {
			delete servers[addr].state.players[match.capture('steam_id')];
		}
		servers[addr].lastlog = +new Date();
	}

	// map loading
	re = named(/Loading map "(:<map>.*?)"/);
	match = re.exec(text);
	if (match !== null) {
		for (var prop in servers[addr].state.playerrs) {
			if (servers[addr].state.players.hasOwnProperty(prop)) {
				delete servers[addr].state.players[prop];
			}
		}
		servers[addr].lastlog = +new Date();
	}

	// map started
	re = named(/Started map "(:<map>.*?)"/);
	match = re.exec(text);
	if (match !== null) {
		servers[addr].newmap(match.capture('map'));
		servers[addr].lastlog = +new Date();
	}

	// round start
	re = named(/World triggered "Round_Start"/);
	match = re.exec(text);
	if (match !== null) {
		servers[addr].round();
		servers[addr].lastlog = +new Date();
	}

	// round end
	re = named(/Team "(:<team>.*)" triggered "SFUI_Notice_(:<team_win>Terrorists_Win|CTs_Win|Target_Bombed|Target_Saved|Bomb_Defused)" \(CT "(:<ct_score>\d+)"\) \(T "(:<t_score>\d+)"\)/);
	match = re.exec(text);
	if (match !== null) {
		var score = {
			'TERRORIST': parseInt(match.capture('t_score')),
			'CT': parseInt(match.capture('ct_score'))
		};
		servers[addr].score(score);
		servers[addr].lastlog = +new Date();
	}

	// !command
	re = named(/"(:<user_name>.+)[<](:<user_id>\d+)[>][<](:<steam_id>.*)[>][<](:<user_team>CT|TERRORIST|Unassigned|Spectator|Console)[>]" say(:<say_team>_team)? "[!\.](:<text>.*)"/);
	match = re.exec(text);
	if (match !== null) {
		var isadmin = match.capture('user_id') == '0' || servers[addr].admin(match.capture('steam_id'));
		param = match.capture('text').split(' ');
		cmd = param[0];
		param.shift();
		switch (String(cmd)) {
		case 'admin':
			break;
		case 'restore':
		case 'replay':
			if (isadmin) servers[addr].restore(param);
			break;
		case 'status':
		case 'stats':
		case 'score':
		case 'scores':
			servers[addr].stats(true);
			break;
		case 'restart':
		case 'reset':
		case 'warmup':
			if (isadmin) servers[addr].warmup();
			break;
		case 'maps':
		case 'map':
		case 'start':
		case 'match':
		case 'startmatch':
			if (isadmin || !servers[addr].get().live) servers[addr].start(param);
			break;
		case 'force':
			if (isadmin) servers[addr].ready(true);
			break;
		case 'resume':
		case 'ready':
		case 'rdy':
		case 'unpause':
			servers[addr].ready(match.capture('user_team'));
			break;
		case 'pause':
			servers[addr].pause(match.capture('user_team'));
			break;
		case 'stay':
			servers[addr].stay(match.capture('user_team'));
			break;
		case 'swap':
		case 'switch':
			servers[addr].swap(match.capture('user_team'));
			break;
		case 'knife':
			servers[addr].knife();
			break;
		case 'disconnect':
		case 'quit':
		case 'leave':
			if (isadmin) {
				servers[addr].quit();
				delete servers[addr];
				console.log('Disconnected from ' + addr);
			}
			break;
		case 'say':
			if (isadmin) servers[addr].say(param.join(' '));
			break;
		case 'debug':
			servers[addr].debug();
			break;

		case 'qwe':
			servers[addr].rcon('script_execute welcome');
			break;
		case 'asd':
			servers[addr].rcon('script welcome');
			break;
		case 'zxc':
			servers[addr].rcon('script buttonReference <- Entities.FindByName( buttonReference, "'+match.capture('user_name')+'" );script ScriptPrintMessageChatAll(buttonReference.GetName())');
			break;
		case 'terro':
			console.log(match.capture('user_name') + ' wants to go terro');
			servers[addr].rcon('script sami <- Entities.FindByName( sami, "'+match.capture('user_name')+'" );script sami.SetTeam(2);');
			break;
		case 'tombo':
			console.log(match.capture('user_name') + ' wants to go tombo');
			servers[addr].rcon('script sami <- Entities.FindByName( sami, "'+match.capture('user_name')+'" );script ScriptPrintMessageChatAll(sami.GetName())');
			break;
		case 'mapname':
			servers[addr].rcon('script ScriptPrintMessageChatAll(RandomInt().tostring());script ScriptPrintMessageChatAll(GetMapName())');
			break;
		case 'time':
			servers[addr].rcon('script mape <- "holi";script ScriptPrintMessageChatAll(mape)');
			break;
		case 'fgh':
			servers[addr].rcon('script mape <- "holi";script ScriptPrintMessageChatAll(mape)');
			break;
		default:
		}
		servers[addr].lastlog = +new Date();
	}
});

s.bind(myport);
process.on('uncaughtException', function (err) {
	console.log(err);
});