from http.server import HTTPServer, BaseHTTPRequestHandler
from websockets import HTTPRequestHandler as WebsocketHandler, AbstractWebSocket as WebSocket
from socketserver import ThreadingMixIn
import socket
import typing

class SafeDict:
	def __init__(self, fields: dict[str, str]):
		self.fields: dict[str, str] = fields
	def get(self, key: str, default: str = ''):
		if key in self.fields:
			return self.fields[key]
		else:
			return default
	@staticmethod
	def from_list(fields: list[tuple[str, str]]):
		f: dict[str, str] = {}
		for i in fields:
			f[i[0]] = i[1]
		return SafeDict(f)
	@staticmethod
	def from_query(q: str):
		fields: dict[str, str] = {}
		for f in q.split("&"):
			s = f.split("=")
			if len(s) >= 2:
				fields[s[0]] = s[1]
		return SafeDict(fields)

class HttpResponse(typing.TypedDict):
	"""A dict containing an HTTP response."""
	status: int
	headers: dict[str, str]
	content: bytes

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
	pass

class WebsocketOrHTTPHandler(WebsocketHandler):
	def __init__(self, interface: "WebServer", request: socket.socket, client_address: tuple[str, int], server: ThreadedHTTPServer):
		self.interface = interface
		super().__init__(request, client_address, server)

	def do_GET(self):
		# Get response from user-supplied server (self.interface extends WebServer)
		splitpath = self.path.split("?")
		res = self.interface.get(splitpath[0], SafeDict.from_query(''.join(splitpath[1:])), SafeDict.from_list(self.headers.items()))
		# Attempt to upgrade?
		if res == "Upgrade to WebSocket":
			try:
				self.opening_handshake()
				self.handleWS()
			except WebsocketHandler.NotWebsocketRequest:
				# Can't upgrade if it's not actually a websocket request.
				self.handleHTTPGet({
					"status": 400, # bad request! go to your room!
					"headers": {},
					"content": ""
				})
		else:
			self.handleHTTPGet(res)

	def do_POST(self):
		self.handleHTTPPost()

	def handleHTTPGet(self, res: HttpResponse):
		# Send status
		self.send_response(res["status"])
		# Send headers
		for h in res["headers"]:
			self.send_header(h, res["headers"][h])
		self.end_headers()
		# Send content
		c = res["content"]
		self.wfile.write(c)

	def handleHTTPPost(self):
		res = self.interface.post(self.path, self.rfile.read(int(self.headers["Content-Length"])))
		self.send_response(res["status"])
		for h in res["headers"]:
			self.send_header(h, res["headers"][h])
		self.end_headers()
		c = res["content"]
		self.wfile.write(c)

	def handleWS(self):
		self.onopen()
		self.listen()
		self.onclose()

	def onopen(self):
		self.interface.connected.append(self.websocket)
		self.interface.websocketOpen(self.websocket)
	def onmessage(self, data: str | bytes):
		self.interface.websocketMessage(self.websocket, data)
	def onclose(self):
		self.interface.connected.remove(self.websocket)
		self.interface.websocketClose(self.websocket)

	def log_message(self, _format: str, *args) -> None: # type: ignore
		return

	@staticmethod
	def getCreator(ws: "WebServer"):
		return lambda request, client_address, server: WebsocketOrHTTPHandler(ws, request, client_address, server)

class WebServer:
	def __init__(self, port: int = 8009, addr: str = '0.0.0.0'):
		self.port = port
		self.addr = addr
		self.server = ThreadedHTTPServer((self.addr, self.port), WebsocketOrHTTPHandler.getCreator(self))
			# that last parameter is a function that will be called every time a request comes in.
			# we pass a function that creates a custom request handler.
		self.connected: list[WebSocket] = []
	def run(self):
		print(f"Server started http://{self.addr}:{self.port}")
		self.server.serve_forever()
	# EVERYTHING BELOW THIS POINT SHOULD BE OVERRIDDEN
	def get(self, path: str, query: SafeDict, headers: SafeDict) -> HttpResponse | typing.Literal["Upgrade to WebSocket"]:
		if path == "/":
			# Upgrade to websocket if we can. `self.websocketOpen` will be called if the connection succeeds.
			if headers.get("Upgrade") == "websocket":
				return "Upgrade to WebSocket"
			# Otherwise, show a simple HTML interface allowing you to send & receive messages.
			return {
				"status": 200,
				"headers": {
					"Content-Type": "text/html"
				},
				"content": b"""<!DOCTYPE html><html><body><script>
function message(color, text) {
	var e = document.createElement("div")
	e.setAttribute("style", `background: color-mix(in srgb, #FFF0 70%, ${color});`)
	e.innerText = text
	document.querySelector("#messages").appendChild(e)
}
var ws = new WebSocket('/');
ws.addEventListener('open', () => { message('blue', 'WebSocket connection opened.') })
ws.addEventListener('close', () => { message('blue', 'WebSocket connection closed.') })
ws.addEventListener('message', (e) => { message('green', e.data.toString()) })
function send(data) {
	ws.send(data)
	message('red', data)
}
</script><div id="messages"></div><div>
<input type="text"><button onclick="send(event.target.previousElementSibling.value)">Send</button><button onclick="ws.close()">Close</button>
</div></body></html>
"""
			}
		else: return {
			"status": 404,
			"headers": {},
			"content": b""
		}
	def post(self, path: str, body: bytes) -> HttpResponse:
		# we don't really care about post requests
		if path == "/":
			print(body)
			return {
				"status": 200,
				"headers": {},
				"content": b""
			}
		else: return {
			"status": 404,
			"headers": {},
			"content": b""
		}
	def websocketOpen(self, websocket: WebSocket):
		websocket.send("hi! you are websocket number " + str(websocket.id))
		# We can access `self.connected` to get all the websockets that are connected.
		# By the time this function is called, `websocket` is already added to `self.connected`.
		for c in self.connected:
			if c == websocket: continue
			c.send("websocket " + str(websocket.id) + " joined")
	def websocketMessage(self, websocket: WebSocket, data: str | bytes):
		websocket.send("you said: " + data)
		for c in self.connected:
			if c == websocket: continue
			c.send("websocket " + str(websocket.id) + " said: " + data)
	def websocketClose(self, websocket: WebSocket):
		# By the time this function is called, `websocket` has been removed from `self.connected`,
		# and it is considered closed. Attempting to send any more messages will throw an error!
		# (see websockets.py line 194)
		for c in self.connected:
			c.send("websocket " + str(websocket.id) + " left")

if __name__ == '__main__':
	w = WebServer()
	w.run()
