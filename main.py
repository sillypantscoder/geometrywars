from http.server import BaseHTTPRequestHandler, HTTPServer
import typing
import os
import sys
import datetime

hostName = "0.0.0.0"
serverPort = 9917

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

class URLQuery(SafeDict):
	def __init__(self, q: str):
		fields: dict[str, str] = {}
		for f in q.split("&"):
			s = f.split("=")
			if len(s) >= 2:
				fields[s[0]] = s[1]
		super().__init__(fields)
		self.orig = q

def read_file(filename: str) -> bytes:
	"""Read a file and return the contents."""
	f = open(filename, "rb")
	t = f.read()
	f.close()
	return t

def write_file(filename: str, content: bytes):
	"""Write data to a file."""
	f = open(filename, "wb")
	f.write(content)
	f.close()

def log(msg: str):
	f = open("log.txt", "a")
	f.write(datetime.datetime.now().isoformat())
	f.write(" - ")
	f.write(msg)
	f.write("\n")
	f.close()

def log_existence_check():
	if os.path.isfile("log.txt"):
		if b"-" not in read_file("log.txt"):
			os.remove("log.txt")

class HttpResponse(typing.TypedDict):
	"""A dict containing an HTTP response."""
	status: int
	headers: dict[str, str]
	content: str | bytes

def get(path: str, query: URLQuery, headers: SafeDict) -> HttpResponse:
	log_existence_check()
	if path == "/":
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": read_file("index.html")
		}
	elif path == "/three.js":
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/javascript"
			},
			"content": read_file("three.js")
		}
	elif path == "/index.js":
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/javascript"
			},
			"content": read_file("index.js")
		}
	else: # 404 page
		log("404 encountered: " + path)
		return {
			"status": 404,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": ""
		}

def post(path: str, body: bytes) -> HttpResponse:
	bodydata = body.decode("UTF-8")
	if path == "/":
		log("404 POST encountered: " + path + "\n\t" + bodydata)
		return {
			"status": 404,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": ""
		}
	else:
		log("404 POST encountered: " + path)
		return {
			"status": 404,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": ""
		}

class MyServer(BaseHTTPRequestHandler):
	def do_GET(self):
		# Get response
		splitpath = self.path.split("?")
		res = get(splitpath[0], URLQuery(''.join(splitpath[1:])), SafeDict.from_list(self.headers.items()))
		# Send status
		self.send_response(res["status"])
		# Send headers
		for h in res["headers"]:
			self.send_header(h, res["headers"][h])
		self.end_headers()
		# Send content
		c = res["content"]
		if isinstance(c, str): c = c.encode("utf-8")
		self.wfile.write(c)
	def do_POST(self):
		res = post(self.path, self.rfile.read(int(self.headers["Content-Length"])))
		self.send_response(res["status"])
		for h in res["headers"]:
			self.send_header(h, res["headers"][h])
		self.end_headers()
		c = res["content"]
		if isinstance(c, str): c = c.encode("utf-8")
		self.wfile.write(c)
	def log_message(self, _format: str, *args) -> None: # type: ignore
		return

if __name__ == "__main__":
	running = True
	webServer = HTTPServer((hostName, serverPort), MyServer)
	webServer.timeout = 1
	print(f"Server started http://{hostName}:{serverPort}")
	sys.stdout.flush()
	while running:
		try:
			webServer.handle_request()
		except KeyboardInterrupt:
			running = False
	webServer.server_close()
	print("Server stopped")
