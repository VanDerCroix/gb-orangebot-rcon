
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

});

function Player(steamid, team, name, clantag) {
	this.steamid = steamid;
	this.team = team;
	this.name = name;
	this.clantag = clantag;
}
function Server(address, pass, adminip, adminid, adminname) {
	var tag = this;
	this.state = {
		ip: address.split(':')[0],
		port: address.split(':')[1] || 27015,
		pass: pass,
		live: false,
		map: '',
		maps: [],
		knife: false,
		score: [],
		knifewinner: false,
		paused: false,
		freeze: false,
		unpause: {
			'TERRORIST': false,
			'CT': false
		},
		ready: {
			'TERRORIST': false,
			'CT': false
		},
		steamid: [],
		admins: [],
		queue: [],
		players: {},
		pauses: {}
	};
	this.realrcon = async function (cmd) {
		if (cmd === undefined) return;
		//console.log(cmd);
		const conn = new rcon({
		    host: this.state.ip,
		    port: this.state.port
		});
		try {
			await conn.authenticate(this.state.pass);
			cmd = cmd.split(';');
			for (var i in cmd) {
				conn.execute(String(cmd[i]));
			}
			conn.disconnect()
		} catch(e) {
		    console.error(e);
		}
	};

	this.realrcon('sv_rcon_whitelist_address ' + myip + ';logaddress_add ' + myip + ':' + myport + ';log on');
	//this.status();

	//s.send("plz go", 0, 6, this.state.port, this.state.ip); // SRCDS won't send data if it doesn't get contacted initially
	console.log('Connected to ' + this.state.ip + ':' + this.state.port + ', pass ' + this.state.pass);
}

s.bind(myport);
process.on('uncaughtException', function (err) {
	console.log(err);
});
function initConnection() {
	if(serverType == "local") myip = localIp;
	
	for (var i in server_config) {
		if (server_config.hasOwnProperty(i)) {
			addServer(server_config[i].host, server_config[i].port, server_config[i].pass);
		}
	}
	console.log('OrangeBot listening on ' + myport);
	console.log('Run this in CS console to connect or configure orangebot.js:');
	console.log('connect YOUR_SERVER;password YOUR_PASS;rcon_password YOUR_RCON;rcon sv_rcon_whitelist_address ' + myip + ';rcon logaddress_add ' + myip + ':' + myport + ';rcon log on; rcon rcon_password '+rcon_pass+"\n");
	
	console.log('starting genbby server match');
	//servers['142.93.81.233:27015'].start(['overpass', 'cache', 'mirage'])
}

function id64(steamid) {
	return (new SteamID(String(steamid))).getSteamID64();
}

function addServer(host, port, pass) {
	dns.lookup(host, 4, function (err, ip) {
		servers[ip + ':' + port] = new Server(ip + ':' + port, pass);
	});
}
initConnection()