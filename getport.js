var fp = require("find-free-port")
fp(8000, function(err, freePort){
	console.log('free port found: ' + freePort);
});

async function getp() {
	try {
		const port = await fp(40000)
		console.log('waiting');
		console.log('async: ' + port);
	} catch(e) {
		console.log('fallo');
		console.log(e);
	}
	
}
getp()