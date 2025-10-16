'use client';

import { createLightNode, createEncoder, createDecoder, LightNode, waitForRemotePeer, Protocols } from "@waku/sdk";
import protobuf from "protobufjs";
import { Address } from "viem";

/**
 * Waku Heartbeat System
 *
 * Allows users to publish periodic "heartbeat" pings that can be monitored
 * by others who have the user's code phrase. If heartbeats stop, subscribers
 * are notified.
 */

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_TIMEOUT = 15 * 60 * 1000; // 15 minutes (3 missed heartbeats)
const DEFAULT_PUBSUB_TOPIC = "/waku/2/default-waku/proto";

// Define Protobuf message structure for heartbeats
const HeartbeatMessage = new protobuf.Type("HeartbeatMessage")
  .add(new protobuf.Field("timestamp", 1, "uint64"))
  .add(new protobuf.Field("address", 2, "string"))
  .add(new protobuf.Field("message", 3, "string"));

export interface HeartbeatConfig {
  address: Address;
  enabled: boolean;
  codePhrase?: string;
}

/**
 * Generate a memorable code phrase from a wallet address
 * Uses the last 6 characters of the address to generate a 3-word phrase
 */
export function generateCodePhrase(address: Address): string {
  // Word lists for generating memorable phrases
  const adjectives = [
    "swift", "bright", "calm", "brave", "wise", "kind", "bold", "clear",
    "free", "true", "quick", "strong", "gentle", "proud", "keen", "pure"
  ];

  const nouns = [
    "eagle", "river", "mountain", "forest", "ocean", "star", "moon", "sun",
    "wind", "stone", "fire", "sky", "cloud", "tree", "wave", "light"
  ];

  const colors = [
    "red", "blue", "green", "gold", "silver", "amber", "jade", "ruby",
    "pearl", "coral", "azure", "violet", "crimson", "indigo", "emerald", "bronze"
  ];

  // Use address to seed the word selection
  const addressLower = address.toLowerCase();
  const hash = addressLower.slice(-8); // Last 8 characters

  // Convert hex to indices
  const index1 = parseInt(hash.slice(0, 2), 16) % adjectives.length;
  const index2 = parseInt(hash.slice(2, 4), 16) % colors.length;
  const index3 = parseInt(hash.slice(4, 6), 16) % nouns.length;

  return `${adjectives[index1]}-${colors[index2]}-${nouns[index3]}`;
}

/**
 * Hash a code phrase to create a Waku content topic
 */
export async function generateContentTopic(codePhrase: string): Promise<string> {
  // Create a hash of the code phrase for the content topic
  const encoder = new TextEncoder();
  const data = encoder.encode(codePhrase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

  // Format: /canary-heartbeat/1/{hash}/proto
  return `/canary-heartbeat/1/${hashHex}/proto`;
}

/**
 * Waku Heartbeat Service
 */
export class HeartbeatService {
  private node: LightNode | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private config: HeartbeatConfig | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🔄 Initializing Waku light node...');
      this.node = await createLightNode({ defaultBootstrap: true });
      await this.node.start();

      // Wait for remote peers to be available for LightPush and Filter protocols
      console.log('⏳ Waiting for remote peers (LightPush & Filter)...');
      await waitForRemotePeer(this.node, [Protocols.LightPush, Protocols.Filter]);

      console.log('✅ Waku light node started and connected to peers');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Waku node:', error);
      throw error;
    }
  }

  async startHeartbeat(address: Address) {
    if (!this.node || !this.isInitialized) {
      await this.initialize();
    }

    // Generate code phrase for this address
    const codePhrase = generateCodePhrase(address);
    const contentTopic = await generateContentTopic(codePhrase);

    console.log(`💓 Starting heartbeat for ${address}`);
    console.log(`🔑 Code phrase: ${codePhrase}`);
    console.log(`📡 Content topic: ${contentTopic}`);

    this.config = {
      address,
      enabled: true,
      codePhrase,
    };

    // Create encoder with routingInfo that contains the pubsubTopic
    const encoder = createEncoder({
      contentTopic,
      routingInfo: {
        pubsubTopic: DEFAULT_PUBSUB_TOPIC
      }
    });

    // Send initial heartbeat
    await this.sendHeartbeat(encoder, address);

    // Set up periodic heartbeat
    this.intervalId = setInterval(async () => {
      if (this.config?.enabled) {
        await this.sendHeartbeat(encoder, address);
      }
    }, HEARTBEAT_INTERVAL);
  }

  private async sendHeartbeat(encoder: any, address: Address) {
    if (!this.node) return;

    try {
      const protoMessage = HeartbeatMessage.create({
        timestamp: BigInt(Date.now()),
        address: address,
        message: "alive",
      });

      const payload = HeartbeatMessage.encode(protoMessage).finish();

      // Send using LightPush - the message is just the payload bytes
      await this.node.lightPush.send(encoder, { payload });

      console.log(`💓 Heartbeat sent at ${new Date().toISOString()}`);
    } catch (error) {
      console.error('❌ Failed to send heartbeat:', error);
    }
  }

  stopHeartbeat() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.config) {
      this.config.enabled = false;
    }

    console.log('⏹️ Heartbeat stopped');
  }

  async subscribeToHeartbeat(codePhrase: string, callback: (heartbeat: any) => void) {
    if (!this.node || !this.isInitialized) {
      await this.initialize();
    }

    const contentTopic = await generateContentTopic(codePhrase);

    // Create decoder with routingInfo
    const decoder = createDecoder(contentTopic, {
      pubsubTopic: DEFAULT_PUBSUB_TOPIC
    });

    console.log(`👂 Subscribing to heartbeat with code phrase: ${codePhrase}`);

    let lastHeartbeat = Date.now();
    let timeoutCheckInterval: NodeJS.Timeout | null = null;

    const messageCallback = (wakuMessage: any) => {
      if (!wakuMessage.payload) return;

      try {
        const messageObj = HeartbeatMessage.decode(wakuMessage.payload);
        lastHeartbeat = Date.now();

        console.log(`💓 Heartbeat received from ${messageObj.address} at ${new Date(Number(messageObj.timestamp)).toISOString()}`);

        callback({
          address: messageObj.address,
          timestamp: Number(messageObj.timestamp),
          message: messageObj.message,
          isAlive: true,
        });
      } catch (error) {
        console.error('❌ Failed to decode heartbeat message:', error);
      }
    };

    // Subscribe to messages
    await this.node?.filter.subscribe([decoder], messageCallback);

    // Check for timeout
    timeoutCheckInterval = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;

      if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.log('⚠️ Heartbeat timeout detected!');
        callback({
          address: null,
          timestamp: Date.now(),
          message: 'Heartbeat timeout - no signal received',
          isAlive: false,
        });
      }
    }, 60 * 1000); // Check every minute

    // Return unsubscribe function
    return () => {
      if (timeoutCheckInterval) {
        clearInterval(timeoutCheckInterval);
      }
      // Note: Waku filter unsubscribe would go here
      console.log('👋 Unsubscribed from heartbeat');
    };
  }

  getCodePhrase(): string | null {
    return this.config?.codePhrase || null;
  }

  isEnabled(): boolean {
    return this.config?.enabled || false;
  }

  async destroy() {
    this.stopHeartbeat();

    if (this.node) {
      await this.node.stop();
      this.node = null;
    }

    this.isInitialized = false;
    console.log('🗑️ Heartbeat service destroyed');
  }
}

// Singleton instance
let heartbeatServiceInstance: HeartbeatService | null = null;

export function getHeartbeatService(): HeartbeatService {
  if (!heartbeatServiceInstance) {
    heartbeatServiceInstance = new HeartbeatService();
  }
  return heartbeatServiceInstance;
}
