import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface SubscribePayload {
  room: 'config' | 'account';
  id: string;
}

/**
 * Real-time stream at namespace `/stream`. Clients authenticate with a JWT in
 * the handshake, then subscribe to a `config` or `account` room to receive
 * `copy_event` / `account_snapshot` messages.
 */
@WebSocketGateway({ namespace: '/stream', cors: { origin: true } })
export class StreamGateway implements OnGatewayConnection {
  private readonly logger = new Logger(StreamGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);
      if (!token) throw new Error('missing token');
      client.data.user = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      client.emit('unauthorized', { message: 'invalid or missing token' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribePayload,
  ): { subscribed: string } | { error: string } {
    if (!client.data.user) return { error: 'unauthorized' };
    if (!body?.room || !body?.id) return { error: 'room and id required' };
    const key = `${body.room}:${body.id}`;
    void client.join(key);
    return { subscribed: key };
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribePayload,
  ): { unsubscribed: string } {
    const key = `${body.room}:${body.id}`;
    void client.leave(key);
    return { unsubscribed: key };
  }

  emitCopyEvent(evt: {
    copierConfigId: string | null;
    sourceAccountId: string;
    receiverAccountId: string;
  }): void {
    const emitter = this.server
      .to(`account:${evt.sourceAccountId}`)
      .to(`account:${evt.receiverAccountId}`);
    if (evt.copierConfigId) emitter.to(`config:${evt.copierConfigId}`);
    emitter.emit('copy_event', evt);
  }

  emitSnapshot(snap: { accountId: string }): void {
    this.server.to(`account:${snap.accountId}`).emit('account_snapshot', snap);
  }
}
