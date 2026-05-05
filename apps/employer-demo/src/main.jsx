import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { I18nProvider, ThemeProvider, AppStateProvider } from './contexts';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);
