import './ui/styles/main.css';
import { GameApp } from './app/GameApp';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const uiLayer = document.getElementById('ui-layer') as HTMLElement | null;

if (!canvas || !uiLayer) {
  throw new Error('Missing #game-canvas or #ui-layer root elements in index.html');
}

const app = new GameApp(canvas, uiLayer);
app.start();

// Expose non-intrusive debug handle on window for local inspection if desired
(window as unknown as { __CLOUDSPIRE__?: GameApp }).__CLOUDSPIRE__ = app;
