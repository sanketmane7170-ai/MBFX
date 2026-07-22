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
  room: 'master' | 'slave';
  id: string;
}

/**
 * Real-time stream at namespace `/stream`.
 * Auth: the client passes a JWT access token in the handshake (`auth.token`
 * or `?token=`); it's verified on connection. Clients then `subscribe` to a
 * master/slave room and receive `copy_event` / `account_snapshot` messages.
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

      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      client.data.user = payload;
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

  /** Broadcast a copy event to both the master's and the slave's room. */
  emitCopyEvent(evt: { masterAccountId: string; slaveAccountId: string }): void {
    this.server
      .to(`master:${evt.masterAccountId}`)
      .to(`slave:${evt.slaveAccountId}`)
      .emit('copy_event', evt);
  }

  emitSnapshot(snap: { accountId: string; accountType: string }): void {
    const room = `${snap.accountType === 'MASTER' ? 'master' : 'slave'}:${snap.accountId}`;
    this.server.to(room).emit('account_snapshot', snap);
  }
}
