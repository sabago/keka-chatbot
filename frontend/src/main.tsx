import ReactDOM from 'react-dom/client';
import App from './App';
// Self-hosted Roboto: CSP font-src is 'self', and visitors' IPs aren't sent to Google
import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
