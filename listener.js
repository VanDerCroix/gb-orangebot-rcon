
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
var server_config = nconf.get('server');
var serverType = nconf.get('serverType');

s.on('message', function (msg, info) {
	var addr = info.address + ':' + info.port;
	var text = msg.toString()
	var match, re
	console.log(text);

	// connected
	re = named(/get5_event: (:<event>.+)/);
	match = re.exec(text);
	if (match !== null) {
		var event = match.capture('event');
		console.log('event catched: ' + msg.event+ " "+msg.matchid);
	}
});
s.bind(myport);

function Server(address, pass, adminip, adminid) {
	var tag = this;
	this.state = {
		ip: address.split(':')[0],
		port: address.split(':')[1] || 27015,
		pass: pass
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
	console.log('Connected to ' + this.state.ip + ':' + this.state.port + ', pass ' + this.state.pass);
}



function initConnection() {
	if(serverType == "local") myip = localIp;
	
	for (var i in server_config) {
		if (server_config.hasOwnProperty(i)) {
			addServer(server_config[i].host, server_config[i].port, server_config[i].pass);
		}
	}
	console.log('OrangeBot listening on ' + myport);
}

function addServer(host, port, pass) {
	dns.lookup(host, 4, function (err, ip) {
		servers[ip + ':' + port] = new Server(ip + ':' + port, pass);
	});
}

initConnection()