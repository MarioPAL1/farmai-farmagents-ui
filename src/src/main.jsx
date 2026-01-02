import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>FarmaAI UI</h1>
      <p>React + Vite is running.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
