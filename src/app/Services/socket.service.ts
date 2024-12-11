import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket;
  private playerListSubject = new BehaviorSubject<any[]>([]);
  playerList$ = this.playerListSubject.asObservable();

  constructor() {
    this.socket = io('http://localhost:3000');

    this.socket.on('updatePlayers', (players: any[]) => {
      this.playerListSubject.next(players);
    });
  }

  joinGame(username: string): void {
    this.socket.emit('join', username);
  }

  getPlayerList() {
    return this.playerList$;
  }

}
