/*	TODO list
 *	method comments
 *	error handling
 *	add get_stream, save_stream
 *	class implementation???
 *
 * */

import WebSocket from "ws";
import http2 from "http2"

let metax_connection = 0;
let websocket_session = 0;
let session_token = 0;
let listened_uuids = {};

/*
 *	@param h 	-	host metax
 *	@param key 	-	{optional} CA private key
 *	@param cert 	-	{optional} CA certificate
 *	@param password	-	{optional} CA password
 *	@param timeout 	-	{optional} session timeout for disconnecting
 *	TODO add websocket connection inside
 * */
async function connect(h, key = null, cert = null, password = null) {
	try {
		if(metax_connection !== 0) { 
			return {"error": "already connected"}
		}
		if(cert !== null && key !== null) {
			metax_connection = http2.connect(`https://${h}`,
				{cert, key, password})
		} else {
			metax_connection = http2.connect(`https://${h}`)
		}
		let result = await wait_for_session_connection(metax_connection);
		if(result.status === "success") {
			await connect_websocket(h, key, cert, password);
		} else {
			return {"error": result.msg}
		}
		return metax_connection;
	} catch(e) {
		return {error: e}
	} 
}

/*
 *	@brief uuid validator
 * */
function is_valid_uuid(u) {
	return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(u) ||
                /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(u);
}

/*
 *	TODO
 * */
async function disconnect() {

}

async function get(u) {
	if(is_valid_uuid(u)) {
		return await https_get(`/db/get?id=${u}`)
	} else {
		throw new Error("invalid uuid")
	}
}

/*
 *	TODO
 * */
async function save(d, m) {
	let path = "/db/save/node";
	return await https_post(d, m, path);
}

async function update(u, d, m) {
	if(is_valid_uuid(u)){
		let path = `/db/save/node?id=${u}`;
		return await https_post(d, m, path);
	}else{
		throw new Error("invalid uuid");
	}
}

async function delete_uuid(u) {
	if(is_valid_uuid(u)) {
		return await https_get(`/db/delete?id=${u}`)
	} else {
		throw new Error("invalid uuid")
	}
}

async function register_listener(u, cb) {
	if(is_valid_uuid(u)) {
		if(typeof cb !== "function") {
			throw new Error("callback is not a function");
		}
		if(listened_uuids[u] === undefined) {
			let path = `/db/register_listener?id=${u}&token=${session_token}`
			let metax_response  = await https_get(path);
			let obj = JSON.parse(metax_response);
			if(obj.status === "success") {
				listened_uuids[u] = [];
				listened_uuids[u].push(cb);
				return {"status":"success"};
			} else {
				throw new Error(JSON.stringify(obj));
			}
		} else {
			if(listened_uuids[u].findIndex(el => el === cb) !== -1) {
				throw new Error("callback was already registered");
			} else {
				listened_uuids[u].push(cb);
			}
		}
	} else {
		throw new Error("invalid uuid")
	}
}

/*
 *	TODO
 * */
async function unregister_listener(u, cb) {
	if(listened_uuids[u] === undefined) {
		throw new Error("no listener found");
	}
	let cb_i = listened_uuids[u].findIndex(el => el === cb)
	if(cb_i === -1) {
		throw new Error("no listener found");
	} else {
		listened_uuids[u].splice(cb_i, 1);
		if(listened_uuids[u].length === 0) {
			let path = `/db/unregister_listener?id=${u}&token=${session_token}`
			let metax_response  = await https_get(path);
			let obj = JSON.parse(metax_response);
			if(obj.status !== "success") {
				console.error("failed to cleanup listener for ", u);
			}
			return {"status": "success"};
		}
	}
}

/*
 *	TODO
 * */
async function reconnect() {

}

/* private */
async function wait_for_session_connection(session) {
	return new Promise((res, rej) => {
		session.on("connect", () => res({status:"success"}));
		session.on("error", (e) => res({status:"failed", msg: e}));
	})
}

/* private */
async function connect_websocket(h, key, cert, password) {
	return new Promise((res, rej) => {
		console.assert(websocket_session === 0, "already have websocket session");
		websocket_session = new WebSocket(`wss://${h}`, {key, cert});
		websocket_session.on("message", dispatch_websocket_message);
		websocket_session.on("error", (e) => rej({"error": e}));
		websocket_session.on("open", () => {
			if(Object.keys(listened_uuids).length !== 0) {
				handle_websocket_reconnection();
			}
			res({"status": "connected"});
		});
		websocket_session.on("close", handle_websocket_close);
	})
}

//TODO
async function dispatch_websocket_message(m) {
	try {
		let msg = JSON.parse(m);
		switch(msg.event) {
			case "connected":
				console.log("received session token:", msg.token);
				session_token = msg.token;
				break;
			case "update":
				handle_websocket_update_event(msg);
				break;
			default:
				console.error("Websocket Error: received unhandled request", msg);
				break;
		}
	} catch (e) {
		console.error("Websocket Error: ", e);
	}
}

//TODO
async function handle_websocket_reconnection() {

}

//TODO
async function handle_websocket_close(e) {

}

/* private */
function handle_websocket_update_event(msg) {
	console.assert(msg.event === "update",
		`handle_websocket_update_event received wrong event: ${msg.event}`);
	let callbacks = listened_uuids[msg.uuid];
	console.assert(callbacks.length > 0, `received update message for ${msg.uuid} but no listener was found.`);
	for(let i = 0; i < callbacks.length; i++) {
		callbacks[i]();
	}
}

/* private */
async function https_get(path) {
        return new Promise((resolve, reject) => {
                const get_request = metax_connection.request({
                        ":path": path,
                        ":method": "GET"
                })
                let data = "";
                get_request
                        .on("data", c => data += c)
                        .on("end", () => {
                                resolve(data);
                        })
                        .on("error", reject);
        });
}

/* private */
async function https_post(d, m, path) {
        return new Promise((resolve, reject) => {
                const post_request = metax_connection.request({
                        ":path": path,
			"content-type": m,
                        ":method": "POST"
                })
		post_request.write(d);
		post_request.end();
                let data = "";
                post_request
                        .on("data", c => data += c)
                        .on("end", () => {
				try {
					data = JSON.parse(data);
					resolve(data.uuid);
				} catch(e) {
					reject(e);
				}
                        })
                        .on("error", reject);
        });
}



async function save_stream(d, type) {
        return new Promise((resolve, reject) => {
                const save_request = metax_connection.request({
                        ":path": "/db/save/node",
                        ":method": "POST",
                        "content-type": `${type}`})
                d.on("data", c => save_request.write(c));
                d.on("end", () => save_request.end());
                let data = "";
                save_request
                        .on("data", c => data += c)
                        .on("end", () => {
                                try {
                                        const res = JSON.parse(data);
                                        if("uuid" in res) {
                                                resolve(res.uuid)
                                        } else {
                                                reject(res);
                                        }
                                } catch(e) {
                                        reject(e);
                                }
                        })
                        .on("error", reject);
        });
}

function get_stream(uuid) {
        return metax_connection.request({
                ":path": `/db/get?id=${uuid}`,
                ":method": "GET"
        })
}

const metax = { 
	  connect
	, get
	, save
	, delete_uuid
	, register_listener
	, unregister_listener
	, disconnect
	, get_stream
	, save_stream
	, update
};

export default metax;
