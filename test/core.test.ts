/// <reference types="vite-plus/test/globals" />

import http from "node:http";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { OAuth2Authenticator } from "../src/auth";
import { Client } from "../src/client";
import { WebhookServer } from "../src/webhook";
import { MediaUploader } from "../src/helpers/media-uploader";
import { MediaUploadStatus } from "../src/types";
import { getSendEventRequestType } from "../src/proto";
import type { Authenticator } from "../src/auth";
import type { EventHandler } from "../src/event";

//  Mock gRPC / proto

vi.mock("../src/proto", () => {
  return {
    getApiServiceClient: vi.fn(
      () =>
        class MockGrpcClient {
          close() {}
        },
    ),
    getStreamServiceClient: vi.fn(
      () =>
        class MockStreamClient {
          close() {}
        },
    ),
    getSendEventRequestType: vi.fn(() => ({
      decode: vi.fn(() => ({ events: [] })),
    })),
  };
});

//  Shared helpers

function makeAuth(token = "test-token"): Authenticator {
  return { getAccessToken: vi.fn().mockResolvedValue(token) };
}

/** Create a mock IncomingMessage that emits body data asynchronously */
function makeReq(
  headers: Record<string, string | undefined>,
  body: Buffer = Buffer.alloc(0),
): http.IncomingMessage {
  const emitter = new EventEmitter();
  const req = Object.assign(emitter, {
    headers,
    method: "POST",
    url: "/events",
  });
  setImmediate(() => {
    if (body.length > 0) emitter.emit("data", body);
    emitter.emit("end");
  });
  return req as unknown as http.IncomingMessage;
}

/** Create a mock ServerResponse that records status and body */
function makeRes() {
  const res = { statusCode: 0, body: "" };
  return Object.assign(res, {
    writeHead(code: number) {
      res.statusCode = code;
    },
    end(data?: string) {
      res.body = data ?? "";
    },
  }) as typeof res & http.ServerResponse;
}

// Ed25519 key pair used across WebhookServer tests
const ed25519 = crypto.generateKeyPairSync("ed25519");
const webhookPublicKeyBytes = Buffer.from(
  (ed25519.publicKey.export({ format: "der", type: "spki" }) as Buffer).slice(12),
);

function makeWebhookServer(handler: EventHandler = { handle: vi.fn() }): WebhookServer {
  return new WebhookServer({
    port: 8089,
    publicKey: webhookPublicKeyBytes,
    handler,
  });
}

function makeValidSignature(body: Buffer, timestamp: string): string {
  const data = Buffer.concat([body, Buffer.from(timestamp)]);
  return crypto.sign(null, data, ed25519.privateKey).toString("base64");
}

//  OAuth2Authenticator

describe("OAuth2Authenticator", () => {
  const OPTS = {
    clientId: "client-id",
    clientSecret: "client-secret",
    tokenUrl: "https://example.com/token",
  };

  function stubToken(token: string, expiresIn = 3600) {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: token, token_type: "Bearer", expires_in: expiresIn }),
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("fetches token on first call", async () => {
    const fetchMock = stubToken("tok-abc");
    vi.stubGlobal("fetch", fetchMock);

    const auth = new OAuth2Authenticator(OPTS);
    const token = await auth.getAccessToken();

    expect(token).toBe("tok-abc");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("caches token and avoids duplicate requests", async () => {
    const fetchMock = stubToken("cached-tok");
    vi.stubGlobal("fetch", fetchMock);

    const auth = new OAuth2Authenticator(OPTS);
    await auth.getAccessToken();
    await auth.getAccessToken();
    await auth.getAccessToken();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("refreshes token after expiry", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        call++;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            access_token: `tok-${call}`,
            token_type: "Bearer",
            expires_in: 3600,
          }),
        });
      }),
    );

    const auth = new OAuth2Authenticator(OPTS);
    const t1 = await auth.getAccessToken();

    // Force expiry by backdating expiresAt
    (auth as unknown as { expiresAt: number }).expiresAt = Date.now() - 1;

    const t2 = await auth.getAccessToken();
    expect(t1).toBe("tok-1");
    expect(t2).toBe("tok-2");
  });

  test("concurrent calls share a single refresh request", async () => {
    const fetchMock = stubToken("shared-tok");
    vi.stubGlobal("fetch", fetchMock);

    const auth = new OAuth2Authenticator(OPTS);
    const results = await Promise.all([
      auth.getAccessToken(),
      auth.getAccessToken(),
      auth.getAccessToken(),
    ]);

    expect(results).toEqual(["shared-tok", "shared-tok", "shared-tok"]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test("throws when token endpoint returns HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized" }),
    );

    const auth = new OAuth2Authenticator(OPTS);
    await expect(auth.getAccessToken()).rejects.toThrow("401");
  });

  test("URL-encodes special characters in client credentials", async () => {
    const fetchMock = stubToken("tok-encoded");
    vi.stubGlobal("fetch", fetchMock);

    const auth = new OAuth2Authenticator({
      clientId: "id@domain.com",
      clientSecret: "secret=value&more",
      tokenUrl: "https://example.com/token",
    });
    await auth.getAccessToken();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const authHeader = (init.headers as Record<string, string>)["Authorization"]!;
    const decoded = Buffer.from(authHeader.replace("Basic ", ""), "base64").toString();
    // Raw special chars must not appear unencoded
    expect(decoded).not.toContain("@");
    expect(decoded).not.toContain("=");
    expect(decoded).not.toContain("&");
  });
});

//  Client

describe("Client", () => {
  function createClient(token = "test-token") {
    return new Client({ apiAddress: "localhost:443", authenticator: makeAuth(token) });
  }

  test("getAccessToken delegates to authenticator", async () => {
    const getAccessToken = vi.fn().mockResolvedValue("my-token");
    const client = new Client({
      apiAddress: "localhost:443",
      authenticator: { getAccessToken },
    });
    expect(await client.getAccessToken()).toBe("my-token");
    expect(getAccessToken).toHaveBeenCalledOnce();
  });

  test("getUsers returns mapped users", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockResolvedValue({
      users: [{ userId: "u1", name: "alice" }],
    });
    const users = await client.getUsers(["u1"]);
    expect(users).toHaveLength(1);
    expect(users[0]!.userId).toBe("u1");
  });

  test("getUsers returns empty array when response has no users", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockResolvedValue({});
    const users = await client.getUsers([]);
    expect(users).toEqual([]);
  });

  test("getPosts returns mapped posts", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockResolvedValue({
      posts: [{ postId: "p1", text: "hi", postMediaList: [], stamps: [] }],
    });
    const posts = await client.getPosts(["p1"]);
    expect(posts[0]!.postId).toBe("p1");
    expect(posts[0]!.text).toBe("hi");
  });

  test("createPost returns the created post", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockResolvedValue({
      post: { postId: "new-1", text: "Hello", postMediaList: [], stamps: [] },
    });
    const post = await client.createPost({ text: "Hello" });
    expect(post.postId).toBe("new-1");
    expect(post.text).toBe("Hello");
  });

  test("deletePost returns true when deleted", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockResolvedValue({ deleted: true });
    expect(await client.deletePost("p1")).toBe(true);
  });

  test("deletePost returns false when not deleted", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockResolvedValue({ deleted: false });
    expect(await client.deletePost("p1")).toBe(false);
  });

  test("deletePost returns false when field is absent", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockResolvedValue({});
    expect(await client.deletePost("p1")).toBe(false);
  });

  test("getStamps returns mapped stamp sets", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockResolvedValue({
      officialStampSets: [
        {
          stampSetId: "set-1",
          name: "Default",
          spriteUrl: "https://example.com/sprite.png",
          stamps: [],
          stampSetType: 1,
        },
      ],
    });
    const stamps = await client.getStamps();
    expect(stamps).toHaveLength(1);
    expect(stamps[0]!.stampSetId).toBe("set-1");
  });

  test("addStampToPost returns updated post", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockResolvedValue({
      post: { postId: "p1", text: "stamped", postMediaList: [], stamps: [] },
    });
    const post = await client.addStampToPost("p1", "stamp-1");
    expect(post.postId).toBe("p1");
  });

  test("propagates gRPC errors to caller", async () => {
    const client = createClient();
    vi.spyOn(client as any, "call").mockRejectedValue(new Error("UNAVAILABLE: connection refused"));
    await expect(client.getPosts(["p1"])).rejects.toThrow("UNAVAILABLE");
  });

  test("call rejects when method not found on gRPC client", async () => {
    const client = createClient();
    // grpcClient is a MockGrpcClient with no methods — call() should reject
    await expect(client.getPosts(["p1"])).rejects.toThrow('Method "getPosts" not found');
  });
});

//  WebhookServer

describe("WebhookServer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when signature header is missing", async () => {
    const server = makeWebhookServer();
    const req = makeReq({});
    const res = makeRes();
    await server.eventHandlerFunc(req, res as unknown as http.ServerResponse);
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain("x-mixi2-application-event-signature");
  });

  test("returns 401 when signature is empty string", async () => {
    const server = makeWebhookServer();
    const req = makeReq({ "x-mixi2-application-event-signature": "" });
    const res = makeRes();
    await server.eventHandlerFunc(req, res as unknown as http.ServerResponse);
    expect(res.statusCode).toBe(401);
  });

  test("returns 401 when timestamp header is missing", async () => {
    const server = makeWebhookServer();
    const req = makeReq({ "x-mixi2-application-event-signature": "dGVzdA==" });
    const res = makeRes();
    await server.eventHandlerFunc(req, res as unknown as http.ServerResponse);
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain("x-mixi2-application-event-timestamp");
  });

  test("returns 401 when timestamp is too old", async () => {
    const server = makeWebhookServer();
    const old = (Math.floor(Date.now() / 1000) - 400).toString();
    const req = makeReq({
      "x-mixi2-application-event-signature": "dGVzdA==",
      "x-mixi2-application-event-timestamp": old,
    });
    const res = makeRes();
    await server.eventHandlerFunc(req, res as unknown as http.ServerResponse);
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain("too old");
  });

  test("returns 401 when timestamp is in the future", async () => {
    const server = makeWebhookServer();
    const future = (Math.floor(Date.now() / 1000) + 400).toString();
    const req = makeReq({
      "x-mixi2-application-event-signature": "dGVzdA==",
      "x-mixi2-application-event-timestamp": future,
    });
    const res = makeRes();
    await server.eventHandlerFunc(req, res as unknown as http.ServerResponse);
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain("future");
  });

  test("returns 401 when signature does not match body", async () => {
    const server = makeWebhookServer();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    // 64-byte buffer of zeroes encoded as base64 — wrong signature
    const badSig = Buffer.alloc(64).toString("base64");
    const req = makeReq(
      {
        "x-mixi2-application-event-signature": badSig,
        "x-mixi2-application-event-timestamp": timestamp,
      },
      Buffer.alloc(0),
    );
    const res = makeRes();
    await server.eventHandlerFunc(req, res as unknown as http.ServerResponse);
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain("invalid");
  });

  test("returns 204 and dispatches non-PING event with valid signature", async () => {
    const handler: EventHandler = { handle: vi.fn().mockResolvedValue(undefined) };
    const server = makeWebhookServer(handler);

    const body = Buffer.alloc(0);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = makeValidSignature(body, timestamp);

    vi.mocked(getSendEventRequestType).mockReturnValue({
      decode: vi.fn().mockReturnValue({
        events: [
          {
            eventId: "e1",
            eventType: 2, // POST_CREATED
            postCreatedEvent: {
              eventReasonList: [],
              post: { postId: "p1", postMediaList: [], stamps: [] },
              issuer: null,
            },
          },
        ],
      }),
    } as ReturnType<typeof getSendEventRequestType>);

    const req = makeReq(
      {
        "x-mixi2-application-event-signature": sig,
        "x-mixi2-application-event-timestamp": timestamp,
      },
      body,
    );
    const res = makeRes();

    await server.eventHandlerFunc(req, res as unknown as http.ServerResponse);
    expect(res.statusCode).toBe(204);

    // Allow fire-and-forget handler to execute
    await new Promise((r) => setTimeout(r, 20));
    expect(handler.handle as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
  });

  test("skips PING events without calling handler", async () => {
    const handler: EventHandler = { handle: vi.fn().mockResolvedValue(undefined) };
    const server = makeWebhookServer(handler);

    const body = Buffer.alloc(0);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = makeValidSignature(body, timestamp);

    vi.mocked(getSendEventRequestType).mockReturnValue({
      decode: vi.fn().mockReturnValue({
        events: [{ eventId: "ping-1", eventType: 1 }], // PING
      }),
    } as ReturnType<typeof getSendEventRequestType>);

    const req = makeReq(
      {
        "x-mixi2-application-event-signature": sig,
        "x-mixi2-application-event-timestamp": timestamp,
      },
      body,
    );
    const res = makeRes();

    await server.eventHandlerFunc(req, res as unknown as http.ServerResponse);
    await new Promise((r) => setTimeout(r, 20));

    expect(res.statusCode).toBe(204);
    expect(handler.handle as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  test("syncHandling awaits handler before eventHandlerFunc resolves", async () => {
    const order: number[] = [];
    const handler: EventHandler = {
      handle: vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push(1);
      }),
    };
    const server = new WebhookServer({
      port: 8089,
      publicKey: webhookPublicKeyBytes,
      handler,
      syncHandling: true,
    });

    const body = Buffer.alloc(0);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = makeValidSignature(body, timestamp);

    vi.mocked(getSendEventRequestType).mockReturnValue({
      decode: vi.fn().mockReturnValue({
        events: [
          {
            eventId: "e2",
            eventType: 2,
            postCreatedEvent: {
              eventReasonList: [],
              post: { postId: "p2", postMediaList: [], stamps: [] },
              issuer: null,
            },
          },
        ],
      }),
    } as ReturnType<typeof getSendEventRequestType>);

    const req = makeReq(
      {
        "x-mixi2-application-event-signature": sig,
        "x-mixi2-application-event-timestamp": timestamp,
      },
      body,
    );
    const res = makeRes();

    await server.eventHandlerFunc(req, res as unknown as http.ServerResponse);
    order.push(2);

    // handler.handle was awaited, so order must be [1, 2]
    expect(order).toEqual([1, 2]);
  });
});

//  MediaUploader

describe("MediaUploader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("upload sends POST with Authorization and Content-Type headers", async () => {
    const client = new Client({
      apiAddress: "localhost:443",
      authenticator: makeAuth("upload-tok"),
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const uploader = new MediaUploader(client);
    await uploader.upload("https://upload.example.com/media", new ArrayBuffer(8));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://upload.example.com/media");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer upload-tok");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/octet-stream",
    );
  });

  test("upload throws on HTTP error with status code", async () => {
    const client = new Client({ apiAddress: "localhost:443", authenticator: makeAuth() });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "Forbidden" }),
    );

    const uploader = new MediaUploader(client);
    await expect(
      uploader.upload("https://upload.example.com/", new ArrayBuffer(4)),
    ).rejects.toThrow("403");
  });

  test("initiate returns mediaId and uploadUrl", async () => {
    const client = new Client({ apiAddress: "localhost:443", authenticator: makeAuth() });
    vi.spyOn(client, "initiatePostMediaUpload").mockResolvedValue({
      mediaId: "m-init",
      uploadUrl: "https://upload.example.com/m-init",
    });

    const uploader = new MediaUploader(client);
    const result = await uploader.initiate({
      contentType: "image/png",
      dataSize: 100,
      mediaType: 1,
    });
    expect(result.mediaId).toBe("m-init");
    expect(result.uploadUrl).toBe("https://upload.example.com/m-init");
  });

  test("waitForReady resolves immediately when status is COMPLETED", async () => {
    const client = new Client({ apiAddress: "localhost:443", authenticator: makeAuth() });
    vi.spyOn(client, "getPostMediaStatus").mockResolvedValue({
      status: MediaUploadStatus.COMPLETED,
    });

    const uploader = new MediaUploader(client);
    const mediaId = await uploader.waitForReady("m1");
    expect(mediaId).toBe("m1");
  });

  test("waitForReady polls until COMPLETED", async () => {
    const client = new Client({ apiAddress: "localhost:443", authenticator: makeAuth() });
    let pollCount = 0;
    vi.spyOn(client, "getPostMediaStatus").mockImplementation(async () => {
      pollCount++;
      return {
        status: pollCount < 3 ? MediaUploadStatus.PROCESSING : MediaUploadStatus.COMPLETED,
      };
    });

    const uploader = new MediaUploader(client, { pollInterval: 10 });
    await uploader.waitForReady("m2");
    expect(pollCount).toBe(3);
  });

  test("waitForReady throws on FAILED status", async () => {
    const client = new Client({ apiAddress: "localhost:443", authenticator: makeAuth() });
    vi.spyOn(client, "getPostMediaStatus").mockResolvedValue({
      status: MediaUploadStatus.FAILED,
    });

    const uploader = new MediaUploader(client);
    await expect(uploader.waitForReady("m3")).rejects.toThrow("m3");
  });

  test("waitForReady throws when timeout expires", async () => {
    const client = new Client({ apiAddress: "localhost:443", authenticator: makeAuth() });
    vi.spyOn(client, "getPostMediaStatus").mockResolvedValue({
      status: MediaUploadStatus.PROCESSING,
    });

    const uploader = new MediaUploader(client, { pollInterval: 10, timeout: 25 });
    await expect(uploader.waitForReady("m4")).rejects.toThrow("timed out");
  });
});
