import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './style.css';

// No StrictMode: its dev double-mount would build the WebGL scene twice.
createRoot(document.getElementById('root')!).render(<App />);
