import { io, type Socket } from 'socket.io-client';
import { getToken } from './api';

export type StreamRoom = { room: 'config' | 'account'; id: string };

/**
 * Connects to the backend Socket.IO `/stream` namespace through the Vite proxy
 * (`/socket.io` → :3000). Authenticates with the current access token.
 */
export function connectStream(): Socket {
  return io('/stream', {
    auth: { token: getToken() ?? '' },
    transports: ['websocket'],
    reconnectionAttempts: 5,
  });
}

export function subscribe(socket: Socket, target: StreamRoom): void {
  socket.emit('subscribe', target);
}
