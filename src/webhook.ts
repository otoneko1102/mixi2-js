import http from "http";
import crypto from "crypto";
import type { EventHandler } from "./event";
import type { Event } from "./types";
import { EventType } from "./types";
import { getSendEventRequestType } from "./proto";
import { convertEvent } from "./convert";

const TIMESTAMP_TOLERANCE = 300; // 5 minutes in seconds

export interface WebhookServerOptions {
  port?: number;
  publicKey: Buffer;
  handler: EventHandler;
  syncHandling?: boolean;
}

export class WebhookServer {
  private readonly server: http.Server;
  private readonly port: number;
  private readonly publicKey: crypto.KeyObject;
  private readonly handler: EventHandler;
  private readonly syncHandling: boolean;

  constructor(options: WebhookServerOptions) {
    this.port = options.port || 8080;
    this.handler = options.handler;
    this.syncHandling = options.syncHandling || false;

    // Convert raw Ed25519 public key bytes to Node.js KeyObject
    const derPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const derKey = Buffer.concat([derPrefix, options.publicKey]);
    this.publicKey = crypto.createPublicKey({
      key: derKey,
      format: "der",
      type: "spki",
    });

    this.server = http.createServer(this.requestListener.bind(this));
  }

  private async requestListener(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200);
      res.end("OK");
      return;
    }

    if (req.method === "POST" && req.url === "/events") {
      await this.handleEvent(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  }

  private async handleEvent(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // Validate signature header
    const signatureBase64 = req.headers[
      "x-mixi2-application-event-signature"
    ] as string | undefined;
    if (!signatureBase64) {
      res.writeHead(401);
      res.end("missing x-mixi2-application-event-signature");
      return;
    }

    let signature: Buffer;
    try {
      signature = Buffer.from(signatureBase64, "base64");
    } catch {
      res.writeHead(401);
      res.end("x-mixi2-application-event-signature is invalid");
      return;
    }

    // Validate timestamp header
    const timestamp = req.headers["x-mixi2-application-event-timestamp"] as
      | string
      | undefined;
    if (!timestamp) {
      res.writeHead(401);
      res.end("missing x-mixi2-application-event-timestamp");
      return;
    }

    const unixTime = parseInt(timestamp, 10);
    if (isNaN(unixTime)) {
      res.writeHead(401);
      res.end("x-mixi2-application-event-timestamp is invalid");
      return;
    }

    const diff = Math.floor(Date.now() / 1000) - unixTime;
    if (diff > TIMESTAMP_TOLERANCE) {
      res.writeHead(401);
      res.end("x-mixi2-application-event-timestamp is too old");
      return;
    }
    if (diff < -TIMESTAMP_TOLERANCE) {
      res.writeHead(401);
      res.end("x-mixi2-application-event-timestamp is in the future");
      return;
    }

    // Read request body
    const body = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

    // Verify Ed25519 signature: sign(body + timestamp)
    const dataToVerify = Buffer.concat([body, Buffer.from(timestamp)]);
    const isValid = crypto.verify(
      null,
      dataToVerify,
      this.publicKey,
      signature,
    );
    if (!isValid) {
      res.writeHead(401);
      res.end("Signature is invalid");
      return;
    }

    // Decode protobuf body
    let events: Event[];
    try {
      const sendEventType = getSendEventRequestType();
      const decoded = sendEventType.decode(new Uint8Array(body)) as {
        events?: unknown[];
      };
      events = (decoded.events || []).map(convertEvent);
    } catch {
      res.writeHead(400);
      res.end("Failed to parse request body");
      return;
    }

    // Respond immediately
    res.writeHead(204);
    res.end();

    // Handle events
    for (const event of events) {
      if (event.eventType === EventType.PING) {
        continue;
      }

      if (this.syncHandling) {
        try {
          await this.handler.handle(event);
        } catch (err) {
          console.error(`Failed to handle event ${event.eventId}:`, err);
        }
      } else {
        Promise.resolve(this.handler.handle(event)).catch((err) => {
          console.error(`Failed to handle event ${event.eventId}:`, err);
        });
      }
    }
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  shutdown(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get address(): string {
    return `:${this.port}`;
  }

  get httpServer(): http.Server {
    return this.server;
  }

  get eventHandlerFunc(): (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<void> {
    return this.handleEvent.bind(this);
  }
}
