import * as grpc from "@grpc/grpc-js";
import type { Authenticator } from "./auth";
import type { EventHandler } from "./event";
import type { Event } from "./types";
import { EventType } from "./types";
import { getStreamServiceClient } from "./proto";
import { convertEvent } from "./convert";

export interface StreamWatcherOptions {
  streamAddress: string;
  authenticator: Authenticator;
  authKey?: string;
}

export class StreamWatcher {
  private readonly authenticator: Authenticator;
  private readonly authKey?: string;
  private readonly streamClient: grpc.Client;
  private aborted = false;

  constructor(options: StreamWatcherOptions) {
    const ClientConstructor = getStreamServiceClient();
    this.streamClient = new ClientConstructor(
      options.streamAddress,
      grpc.credentials.createSsl(),
    );
    this.authenticator = options.authenticator;
    this.authKey = options.authKey;
  }

  private async getMetadata(): Promise<grpc.Metadata> {
    const token = await this.authenticator.getAccessToken();
    const metadata = new grpc.Metadata();
    metadata.add("authorization", `Bearer ${token}`);
    if (this.authKey) {
      metadata.add("x-auth-key", this.authKey);
    }
    return metadata;
  }

  private async connect(): Promise<grpc.ClientReadableStream<unknown>> {
    const metadata = await this.getMetadata();
    const fn = (this.streamClient as unknown as Record<string, Function>)[
      "subscribeEvents"
    ];
    if (!fn) {
      throw new Error("subscribeEvents method not found on stream client");
    }
    return fn.call(
      this.streamClient,
      {},
      metadata,
    ) as grpc.ClientReadableStream<unknown>;
  }

  private async reconnect(): Promise<grpc.ClientReadableStream<unknown>> {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      if (this.aborted) {
        throw new Error("Watcher aborted");
      }

      // Exponential backoff: 1s, 2s, 4s
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000),
      );

      try {
        const stream = await this.connect();
        return stream;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `Reconnect attempt ${i + 1}/${maxRetries} failed:`,
          lastError.message,
        );
      }
    }

    throw lastError || new Error("Failed to reconnect");
  }

  async watch(handler: EventHandler): Promise<void> {
    this.aborted = false;
    let stream = await this.connect();

    return new Promise((resolve, reject) => {
      const setupStream = (s: grpc.ClientReadableStream<unknown>) => {
        s.on("data", (response: Record<string, unknown>) => {
          const events = ((response.events as unknown[]) || []).map(
            convertEvent,
          );
          for (const event of events) {
            if (event.eventType === EventType.PING) {
              continue;
            }
            this.handleEvent(handler, event);
          }
        });

        s.on("error", async (err: Error) => {
          if (this.aborted) {
            resolve();
            return;
          }
          try {
            stream = await this.reconnect();
            setupStream(stream);
          } catch (reconnectErr) {
            reject(reconnectErr);
          }
        });

        s.on("end", () => {
          resolve();
        });
      };

      setupStream(stream);
    });
  }

  private handleEvent(handler: EventHandler, event: Event): void {
    Promise.resolve(handler.handle(event)).catch((err) => {
      console.error(`Failed to handle event ${event.eventId}:`, err);
    });
  }

  stop(): void {
    this.aborted = true;
    this.streamClient.close();
  }
}
