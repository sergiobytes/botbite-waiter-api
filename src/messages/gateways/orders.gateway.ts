import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'orders',
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinBranch')
  handleJoinBranch(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    // Salir de todas las rooms anteriores de sucursales
    const rooms = Array.from(client.rooms).filter(
      (room) => room.startsWith('branch-') && room !== client.id,
    );
    for (const room of rooms) {
      client.leave(room);
    }

    // Unirse a la room de la nueva sucursal
    const roomName = `branch-${branchId}`;
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined branch room: ${roomName}`);

    return { success: true, room: roomName };
  }

  @SubscribeMessage('leaveBranch')
  handleLeaveBranch(
    @MessageBody() branchId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const roomName = `branch-${branchId}`;
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left branch room: ${roomName}`);

    return { success: true };
  }

  emitOrderUpdate(branchId: string) {
    const roomName = `branch-${branchId}`;
    this.logger.log(`Emitting order update to room: ${roomName}`);
    this.server.to(roomName).emit('orderUpdate', { branchId });
  }
}
