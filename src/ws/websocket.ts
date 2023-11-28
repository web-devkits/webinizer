/*-------------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Intel Corporation. All rights reserved.
 *  Licensed under the Apache License 2.0. See LICENSE in the project root for license information.
 *  SPDX-License-Identifier: Apache-2.0
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as ws from "ws";
import * as H from "../helper";
import * as http from "http";
import { validateProjectRoot } from "../api";

const log = H.getLogger("webSocketManager");

export enum WsMessageType {
  UpdateBuildStatus = "updateBuildStatus",
  UpdateDependenciesConfig = "updateDependenciesConfig",
}

export class WebSocketManager {
  static instance: WebSocketManager;
  private webSocketServer: ws.Server | null = null;
  private webSocketConnections = new Map<string, ws[]>();
  private expressServer: http.Server | null = null;

  constructor() {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = this;
    }
    return WebSocketManager.instance;
  }

  initialize(expressServer: http.Server) {
    this.expressServer = expressServer;
    if (!this.webSocketServer) {
      this.webSocketServer = new ws.Server({
        noServer: true,
      });

      this.webSocketServer.on("connection", this.onConnectionHandler);

      this.expressServer?.on("upgrade", (req, socket, head) => {
        const url = new URL(req.url as string, `http://${req.headers.host}`);
        const root = url.searchParams.get("root");
        // validate the project root
        try {
          validateProjectRoot(root as string);
        } catch (e) {
          socket.write(H.serializeError(e as Error));
          socket.destroy();
          return;
        }

        log.warn("the socket request is from the project - ", root);
        this.webSocketServer?.handleUpgrade(req, socket, head, (socket) => {
          this.webSocketServer?.emit("connection", socket, root);
        });
      });
    }
  }

  onConnectionHandler = (webSocketConnection: ws, root: string) => {
    log.warn(`websocket connection established.`);
    this.addWsConnection(root, webSocketConnection);
    webSocketConnection.on("message", this.onMessageHandler);
    webSocketConnection.on("close", () => {
      this.onCloseHandler(root, webSocketConnection);
    });
    webSocketConnection.on("error", () => this.onErrorHandler(root, webSocketConnection));
  };

  onMessageHandler = (msg: any) => {
    log.info("WS: Receive message from websocket client:", msg);
  };

  onCloseHandler = (root: string, ws: ws) => {
    log.warn("WS: close connection.", root);
    this.deleteWsConnection(root, ws);
  };

  private addWsConnection = (root: string, ws: ws) => {
    const wsArray = this.webSocketConnections.get(root) || [];
    // this project has not established any connection

    if (!wsArray.includes(ws)) {
      wsArray.push(ws);
      this.webSocketConnections.set(root, wsArray as ws[]);
      log.warn(`Current websocketConnections of ${root} are ${wsArray.length}`);
    }
  };

  private deleteWsConnection = (root: string, ws: ws) => {
    let wsArray = this.webSocketConnections.get(root) || [];
    if (wsArray.includes(ws)) {
      wsArray = wsArray.filter((w) => w !== ws);
      this.webSocketConnections.set(root, wsArray as ws[]);
      log.warn(`Current websocketConnections of ${root} are ${wsArray.length}`);
    }
  };

  private onErrorHandler = (root: string, ws: ws) => {
    this.deleteWsConnection(root, ws);
    log.error("Error occurred.");
  };

  /**
   *  multiple websocket connections exist at the same time
   *  is supported, this function is to broadcast message to
   *  the all connected websocket clients
   *
   * @param root the project root path
   * @param msgArgs the message object
   */
  broadcastMsg4Project(root: string, msgArgs: { [k: string]: unknown } = {}) {
    const wsArray = this.webSocketConnections.get(root);
    if (wsArray && wsArray.length > 0) {
      wsArray.map((ws) => {
        ws.send(JSON.stringify(msgArgs));
      });
    }
  }

  /**
   * broadcast the message to all connected websocket clients
   * to make sure there is no missing one
   *
   * @param msgArgs the message object
   */
  broadcastMsgToAllClients(msgArgs: { [k: string]: unknown } = {}) {
    this.webSocketConnections.forEach((wsArray) => {
      wsArray.map((ws) => {
        ws.send(JSON.stringify(msgArgs));
      });
    });
  }

  getWebsocketConnections() {
    return this.webSocketConnections;
  }
}
