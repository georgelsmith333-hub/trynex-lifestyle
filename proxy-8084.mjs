import http from "http";
import net from "net";

const TARGET_PORT = 5000;

const server = http.createServer((req, res) => {
  const opts = {
    hostname: "localhost",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${TARGET_PORT}` },
  };
  const proxy = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxy.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("proxy error");
    }
  });
  req.pipe(proxy, { end: true });
});

server.on("upgrade", (req, clientSocket, head) => {
  const proxySocket = net.connect(TARGET_PORT, "localhost", () => {
    const lines = [
      `${req.method} ${req.url} HTTP/1.1`,
      ...Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`),
      "",
      "",
    ];
    proxySocket.write(lines.join("\r\n"));
    if (head && head.length) proxySocket.write(head);
    proxySocket.pipe(clientSocket);
    clientSocket.pipe(proxySocket);
  });
  proxySocket.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => proxySocket.destroy());
});

server.listen(8084, "0.0.0.0", () => {
  console.log("[proxy-8084] Listening on 0.0.0.0:8084 → localhost:5000");
});
