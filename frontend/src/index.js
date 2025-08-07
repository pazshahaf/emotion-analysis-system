// index.js - Entry point for the Emotion Analysis React Application

// Import React library - core framework for building user interfaces
import React from 'react';

// Import ReactDOM for rendering React components into the browser DOM
// Using the new client API introduced in React 18
import ReactDOM from 'react-dom/client';

// Import global CSS styles that apply to the entire application
import './index.css';

// Import the main App component containing the emotion analysis interface
import App from './app';

// Create a root element that will contain the entire React application
// Connects to the 'root' div element in public/index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the application to the DOM
root.render(
  // StrictMode helps identify potential problems in the application during development
  // It activates additional checks and warnings for its descendants
  <React.StrictMode>
    {/* Main App component - contains the emotion analysis functionality */}
    <App />
  </React.StrictMode>
);