import React from 'react'
import ReactDOM from 'react-dom/client'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import './quill-theme.css'
import App from './App.jsx'

// The rich text property editor looks Quill up on window
window.Quill = Quill

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
