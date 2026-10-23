import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// No StrictMode: its double-run effects would log every event twice.
createRoot(document.getElementById('root')).render(<App />);
