const net = require("node:net");
const cluster = require("node:cluster");
const fs = require("node:fs");

// Number of available cores for concurrency
const cores = require("os").cpus().length; // Number of how many pages your CPU can Handle ;

/*/ ----------------------- /*/
const MessageBuffer = require("./utti/utility");
const Script = require("./ScrapingLogic/Logic");
/*/ ----------------------- /*/

(async () => {
	if (cluster.isMaster) {
		// Communication Preps
		const PORT = 8080;
		const HOST = "127.0.0.1";
		const results = {};
		// An array structure which by default removes duplicates

		console.log("[*] Launching Script ...");

		//Loading Proxies
		console.log("[*] Loading Proxies ");
		const ProxiesTxt = fs.readFileSync(
			__dirname + "/proxies.txt",
			(err, data) => {
				if (err) {
					console.log(`[-] Failed To Load Proxies for reason ${err.message}`);
				} else {
					return data;
				}
			},
		);
		const Proxies = ProxiesTxt.toString().split(/\r?\n/);
		console.log(`[+] Loaded ${Proxies.length} Proxy Succesfully `);

		// Starting sub-processes
		for (let i = 0; i < cores; i++) {
			const worker = cluster.fork();
			//We can Send More then Just One Proxy
			//So we can Have a retry After fail in the puppeteer Folder
			worker.send(Proxies[i]);
		}

		// Communication with workers
		const server = net.createServer(on_client_connection);

		server.listen(PORT, HOST, () => {
			console.log(`[+] Master process listening at ${HOST}:${PORT}`);
		});

		function on_client_connection(socket) {
			console.log(`[+] Incoming connection ...`);

			let received = new MessageBuffer("\n");
			socket.on("data", async (data) => {
				let temp = {};
				received.push(data);
				while (!received.isFinished()) {
					const message = received.handleData();
					temp = JSON.parse(message);
					console.log(`[+] From worker # ${temp.from}`);
					console.table(temp.content);
					results[temp.from] = temp.content;
					if (Object.keys(results).length === cores) {
						console.log("[+] Finished Scrapping");
						console.log("[*] Last Save. Exit Code ...");
						console.log(results);
						process.exit(0);
					}
				}
			});

			socket.on("close", () => {
				console.log(
					`[+] Terminated connection from: ${socket.remoteAddress}:${socket.remotePort}`,
				);
			});

			socket.on("error", (error) => {
				console.error(
					`[-] Connection error : ${error} on ${socket.remoteAddress}:${socket.remotePort}`,
				);
			});
		}

		// Termination code for dying processes
		cluster.on("exit", (worker, code, signal) => {
			if (signal) {
				console.log(
					`[-] Worker ${worker.process.pid} was killed by signal: ${signal}`,
				);
			} else if (code !== 0) {
				console.log(
					`[-] Worker ${worker.process.pid} exited with error code: ${code}`,
				);
			} else {
				console.log(`[+] Worker ${worker.process.pid} terminated succesfully.`);
			}
			console.log(cluster.workers);
		});
	} else {
		const PORT = 8080;
		const HOST = "127.0.0.1";
		const socket = new net.Socket();
		socket.connect(PORT, HOST, () => {
			console.log(
				`[+] Worker ${process.pid} connected to the Master through socket.`,
			);
		});
		process.on("message", async (args) => {
			console.log("Launched Sub-process PID #", process.pid);
			console.log(`[+] Worker ${process.pid} Got These Args ${args}`);
			let Origin = await Script(args);
			console.log(`[+] Worker ${process.pid} returned.`);
			socket.write(
				JSON.stringify({ from: process.pid, content: Origin }) + "\n",
			);
			console.log(`[+] Worker ${process.pid} sent return to Master process.`);
		});
	}
})();

// File Save
