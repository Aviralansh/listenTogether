import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';

type AppState = 'disconnected' | 'hosting' | 'connecting' | 'connected';

class PeerService {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  public isHost: boolean = false;
  
  private stateChangeCallback: ((state: AppState) => void) | null = null;
  private messageCallback: ((data: any) => void) | null = null;

  onStateChange(cb: (state: AppState) => void) {
    this.stateChangeCallback = cb;
  }

  onMessage(cb: (data: any) => void) {
    this.messageCallback = cb;
  }

  private setState(state: AppState) {
    if (this.stateChangeCallback) this.stateChangeCallback(state);
  }

  // Generate a friendly ID
  private generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  initHost(onIdGenerated: (id: string) => void) {
    this.setState('hosting');
    this.isHost = true;
    
    const id = this.generateId();
    this.peer = new Peer(id);

    this.peer.on('open', (id) => {
      onIdGenerated(id);
    });

    this.peer.on('connection', (conn) => {
      this.connection = conn;
      this.setupConnection();
    });
  }

  joinSession(hostId: string) {
    this.setState('connecting');
    this.isHost = false;
    
    this.peer = new Peer();

    this.peer.on('open', () => {
      this.connection = this.peer!.connect(hostId);
      this.setupConnection();
    });
  }

  private setupConnection() {
    if (!this.connection) return;

    this.connection.on('open', () => {
      this.setState('connected');
    });

    this.connection.on('data', (data) => {
      if (this.messageCallback) {
        this.messageCallback(data);
      }
    });

    this.connection.on('close', () => {
      this.disconnect();
    });
  }

  sendMessage(data: any) {
    if (this.connection && this.connection.open) {
      this.connection.send(data);
    }
  }

  disconnect() {
    if (this.connection) {
      this.connection.close();
    }
    if (this.peer) {
      this.peer.destroy();
    }
    this.peer = null;
    this.connection = null;
    this.isHost = false;
    this.setState('disconnected');
  }
}

export const peerService = new PeerService();
