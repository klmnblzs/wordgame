import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterTestingHarness } from '@angular/router/testing';
import { io, Socket } from 'socket.io-client';
import { SocketService } from '../../Services/socket.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent implements OnInit, OnDestroy {
  private httpClient = inject(HttpClient)


  private socket: Socket;
  constructor() {
    this.socket = io('http://localhost:3000')
    // this.socket = io('http://192.168.164.135:3000')
  }

  usedWords: string[] = [];
  validWords: string[] = [];

  players: { id: string, username: string }[] = [];
  words: any[] = [];
  gameState: any = "tbd";
  errorMessage:string = '';

  playerId: string = '';

  isJoined: boolean = false;

  gameForm = new FormGroup({
    word: new FormControl('', { validators: [Validators.required] })
  })

  joinForm = new FormGroup({
    username: new FormControl('', { validators: [Validators.required] })
  })

  ngOnInit(): void {
    this.socket.on('updatePlayers', (players: any[]) => {
      this.players = players;
    });

    this.socket.on('updateWords', (words: any[]) => {
      this.words = words
    });

    this.socket.on('updateGameState', (state: any) => {
      this.gameState = state;
    });

    this.socket.on('playerJoined', (data: any) => {
      this.playerId = data.playerId;
    });

    this.loadValidWords()
  }

  ngOnDestroy(): void {
    this.socket.disconnect();
  }

  onJoinGame(): void {
    if (this.joinForm.value.username!.trim()) {
      this.isJoined = true;
      this.socket.emit('join', this.joinForm.value.username);
      this.joinForm.reset()
    }
  }

  onAddWord(): void {
    
    if (this.gameForm.value.word) {
      if(this.validWords.includes(this.gameForm.value.word.toLowerCase())) {
        this.socket.emit('addWord', { word: this.gameForm.value.word.toLowerCase(), playerId: this.playerId });
        
        this.socket.on('addWordError', (error: any) => {
          this.errorMessage=error.error
          return;
        });

        this.socket.on('updateWords', (words: any[]) => {
          this.words = words;
          this.errorMessage='';
          this.gameForm.reset()
        });
      } else {
        this.errorMessage = "Hibás szó"
      }
    } else {
      this.errorMessage = "Adj meg valami szót"
    }
  }
  loadValidWords(): void {
    this.httpClient.get<string[]>('http://localhost:3200/words')
    // this.httpClient.get<string[]>('http://192.168.164.135:3200/words')
      .subscribe(words => {
        this.validWords = words;
      });
  }
}
